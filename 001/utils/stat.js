/**
 * 统计引擎 —— 严格按 PRD §6.3 的口径实现。
 *
 * 最容易出错的一条：产量按「打卡日期」归属年/月，营收按「售出日期」归属年/月，
 * 两者用不同的 key。以下所有函数都遵循这条规则，不要在页面里自行按 date 过滤营收。
 *
 *   累计产量   = sum(check_in.count)，仅 status = normal（未软删除）
 *   售出数量   = sum(sale.quantity)，按 sale.soldDate 归属
 *   未售出数量 = 累计产量 − 售出数量，< 0 时按 0 显示并给出提示
 *   营收       = sum(sale.total_amount)，按 sale.soldDate 归属
 *   每日平均   = 累计产量 ÷ 有记录的天数（不是 ÷ 全年天数）
 */

const db = require('./db')
const { SHAPE_COLORS } = require('./constants')

const CHANNEL_NAMES = {
  xhs: '小红书',
  xianyu: '闲鱼',
  wechat: '微信',
  offline: '线下',
  other: '其他'
}

/** 造型的固定颜色（按 slot 分配，筛选后不重新着色） */
function shapeColor(shape, theme) {
  const list = SHAPE_COLORS[theme === 'dark' ? 'dark' : 'light']
  if (!shape) return list[3]
  const idx = typeof shape.slot === 'number' ? shape.slot : 0
  return list[idx % list.length]
}

/**
 * 造型在页面上的展示对象：名字 + 图标（svg 优先，emoji 兜底）+ 固定色。
 * 页面统一用这个，别自己拼 shapeMap，容易漏掉 iconPath。
 */
function shapeView(shape, theme) {
  if (!shape) {
    return { name: '未知', icon: '❔', iconPath: '', color: '#898781' }
  }
  return {
    name: shape.name,
    icon: shape.icon || '',
    iconPath: shape.iconPath || '',
    color: shapeColor(shape, theme)
  }
}

/** 某年全量打卡（未删除） */
function checkInsOfYear(year) {
  return db.aliveCheckIns().filter((c) => String(c.date).slice(0, 4) === String(year))
}

/** 某年全量售出（按售出日期归属） */
function salesOfYear(year) {
  return db.listSales({ year: year })
}

/**
 * 空的年度总览：给未登录时用。
 *
 * <p>形状和 yearlyOverview 完全一致，只是数值全为 0——
 * 界面直接渲染它就行，不用到处判空。近 6 个月的节奏图也因此自动藏起来
 * （首页那张卡片的显示条件是 production > 0）。
 *
 * @param {string} year
 */
function emptyOverview(year) {
  const monthly = []
  for (let m = 1; m <= 12; m++) monthly.push({ month: m, count: 0, days: 0 })
  const soldMonthly = []
  for (let m = 1; m <= 12; m++) soldMonthly.push({ month: m, amount: 0, quantity: 0 })

  return {
    year: String(year),
    production: 0,
    activeDays: 0,
    avgPerDay: 0,
    recordCount: 0,
    byShape: [],
    monthly: monthly,
    bestMonth: null,
    revenue: 0,
    soldCount: 0,
    unsold: 0,
    unsoldRaw: 0,
    oversold: false,
    avgPrice: 0,
    soldByShape: [],
    byChannel: [],
    soldMonthly: soldMonthly
  }
}

/**
 * 年度总览。
 * @param {string} year
 * @param {string} theme 'light' | 'dark'
 */
function yearlyOverview(year, theme) {  const y = String(year)
  const shapes = db.listShapes()
  const shapeMap = {}
  shapes.forEach((s) => {
    shapeMap[s.id] = s
  })

  const checkIns = checkInsOfYear(y)
  const sales = salesOfYear(y)

  // -- 产量（按打卡日期归属） --
  const production = checkIns.reduce((sum, c) => sum + (Number(c.count) || 0), 0)
  const activeDays = new Set(checkIns.map((c) => c.date)).size
  // 保留一位小数，避免 1.6666666666666667 这类值直接显示到界面上
  const avgPerDay = activeDays ? Math.round((production / activeDays) * 10) / 10 : 0

  const byShapeMap = {}
  checkIns.forEach((c) => {
    const sid = c.shapeId || 'shape_other'
    if (!byShapeMap[sid]) byShapeMap[sid] = { shapeId: sid, count: 0, days: 0 }
    byShapeMap[sid].count += Number(c.count) || 0
    byShapeMap[sid].days += 1
  })

  const byShape = shapes
    .filter((s) => byShapeMap[s.id])
    .map((s) => ({
      shapeId: s.id,
      name: s.name,
      icon: s.icon,
      count: byShapeMap[s.id].count,
      days: byShapeMap[s.id].days,
      color: shapeColor(s, theme),
      percent: production ? (byShapeMap[s.id].count / production) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)

  const monthly = []
  for (let m = 1; m <= 12; m++) {
    const items = checkIns.filter((c) => Number(String(c.date).slice(5, 7)) === m)
    monthly.push({
      month: m,
      count: items.reduce((sum, c) => sum + (Number(c.count) || 0), 0),
      days: new Set(items.map((c) => c.date)).size
    })
  }

  // -- 营收（按售出日期归属） --
  const revenue = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
  const soldCount = sales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const avgPrice = soldCount ? Math.round((revenue / soldCount) * 100) / 100 : 0
  const unsold = production - soldCount

  const soldByShapeMap = {}
  const byChannelMap = {}
  sales.forEach((s) => {
    const ci = db.getCheckIn(s.checkInId)
    const sid = ci ? ci.shapeId : 'shape_other'
    if (!soldByShapeMap[sid]) soldByShapeMap[sid] = { shapeId: sid, quantity: 0, amount: 0 }
    soldByShapeMap[sid].quantity += Number(s.quantity) || 0
    soldByShapeMap[sid].amount += Number(s.totalAmount) || 0

    const ch = s.channel || 'other'
    if (!byChannelMap[ch]) byChannelMap[ch] = { channel: ch, name: CHANNEL_NAMES[ch] || ch, quantity: 0, amount: 0 }
    byChannelMap[ch].quantity += Number(s.quantity) || 0
    byChannelMap[ch].amount += Number(s.totalAmount) || 0
  })

  const soldByShape = shapes
    .filter((s) => soldByShapeMap[s.id])
    .map((s) => ({
      shapeId: s.id,
      name: s.name,
      icon: s.icon,
      quantity: soldByShapeMap[s.id].quantity,
      amount: soldByShapeMap[s.id].amount,
      color: shapeColor(s, theme)
    }))
    .sort((a, b) => b.amount - a.amount)

  const byChannel = Object.keys(byChannelMap)
    .map((k) => byChannelMap[k])
    .sort((a, b) => b.amount - a.amount)

  const soldMonthly = []
  for (let m = 1; m <= 12; m++) {
    const items = sales.filter((s) => Number(String(s.soldDate).slice(5, 7)) === m)
    soldMonthly.push({
      month: m,
      amount: items.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
      quantity: items.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
    })
  }

  const best = monthly.reduce((a, b) => (b.count > a.count ? b : a), monthly[0] || { month: 0, count: 0 })

  return {
    year: y,
    production: production,
    activeDays: activeDays,
    avgPerDay: avgPerDay,
    recordCount: checkIns.length,
    byShape: byShape,
    monthly: monthly,
    bestMonth: best.count > 0 ? best : null,
    revenue: revenue,
    soldCount: soldCount,
    unsold: unsold < 0 ? 0 : unsold,
    unsoldRaw: unsold,
    // 售出数量超过当年产量：可能是跨年卖出或记录被删，按 PRD 显示 0 并提示
    oversold: unsold < 0,
    avgPrice: avgPrice,
    soldByShape: soldByShape,
    byChannel: byChannel,
    soldMonthly: soldMonthly
  }
}

/** 与上一年的对比（口径一致：产量按打卡日期） */
function yearCompare(year) {
  const cur = yearlyOverview(year, 'light')
  const prev = yearlyOverview(Number(year) - 1, 'light')
  const delta = cur.production - prev.production
  const rate = prev.production ? (delta / prev.production) * 100 : null
  return {
    current: cur.production,
    previous: prev.production,
    delta: delta,
    rate: rate,
    hasPrevious: prev.production > 0
  }
}

/** 某年逐日产量，供日历热力图使用 */
function dailyMap(year) {
  const map = {}
  checkInsOfYear(year).forEach((c) => {
    map[c.date] = (map[c.date] || 0) + (Number(c.count) || 0)
  })
  return map
}

/**
 * 全局库存（跨年）：累计产量 − 累计售出，按造型拆分。
 * 这里的口径与年度视图不同：年度视图按年各自结算，库存则看跨年结转。
 */
function inventory(theme) {
  const shapes = db.listShapes()
  const soldMap = db.soldCountByCheckIn()
  const map = {}
  db.aliveCheckIns().forEach((c) => {
    const sid = c.shapeId || 'shape_other'
    if (!map[sid]) map[sid] = { shapeId: sid, made: 0, sold: 0 }
    map[sid].made += Number(c.count) || 0
    map[sid].sold += soldMap[c.id] || 0
  })
  return shapes
    .filter((s) => map[s.id])
    .map((s) => ({
      shapeId: s.id,
      name: s.name,
      icon: s.icon,
      made: map[s.id].made,
      sold: map[s.id].sold,
      stock: Math.max(0, map[s.id].made - map[s.id].sold),
      color: shapeColor(s, theme)
    }))
    .sort((a, b) => b.made - a.made)
}

/** 有数据的年份列表，倒序 */
function availableYears() {
  const dates = db.aliveCheckIns().map((c) => c.date)
  db.listSales().forEach((s) => dates.push(s.soldDate))
  const set = {}
  dates.forEach((d) => {
    if (d) set[String(d).slice(0, 4)] = true
  })
  return Object.keys(set).sort((a, b) => Number(b) - Number(a))
}

/** 连续未记录天数 */
function streak() {
  const dates = {}
  db.aliveCheckIns().forEach((c) => {
    dates[c.date] = true
  })
  const d = require('./date')
  let n = 0
  let cursor = d.today()
  if (!dates[cursor]) cursor = d.addDays(cursor, -1) // 今天还没打卡不算断
  while (dates[cursor]) {
    n += 1
    cursor = d.addDays(cursor, -1)
  }
  return n
}

module.exports = {
  shapeColor,
  shapeView,
  yearlyOverview,
  emptyOverview,
  yearCompare,
  dailyMap,
  inventory,
  availableYears,
  streak,
  CHANNEL_NAMES
}

const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')
const { money } = require('../../../utils/format')

/** 耗时文案：分钟 -> '8.5h' / '45min' */
function durationText(min) {
  if (!min || Number(min) <= 0) return '耗时未记录'
  const n = Number(min)
  if (n >= 60) return '耗时 ' + (Math.round((n / 60) * 10) / 10) + 'h'
  return '耗时 ' + Math.round(n) + 'min'
}

Page({
  data: {
    theme: 'light',
    // 当前是第几个 tab，用于把选中态同步给悬浮 tab bar
    tabIndex: 1,
    years: [],
    year: '',
    yearIndex: 0,
    overview: null,
    compare: { hasPrevious: false },
    shapeBars: [],
    shapeTable: [],
    showShapeTable: false,
    shapeRevenueBars: [],
    channelBars: [],
    monthlyBars: [],
    showTable: false,
    hasData: false,
    // -- 展示用的派生数据 --
    longestStreak: 0,
    sellRate: '0.0',
    compareArrow: '',
    compareYear: '',
    compareRate: '',
    compareDeltaText: 0,
    revenueText: '¥0',
    soldCount: 0,
    avgPriceText: '¥0',
    bestPrice: null,
    works: []
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme })
    this._unsub = db.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.syncTabBar(this.data.tabIndex)
    this.load()
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
    this.syncTabBar(this.data.tabIndex || 0)
    this.load()
  },

  /** 把选中态与主题同步给悬浮 tab bar */
  syncTabBar(selected) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: selected, theme: this.data.theme })
    }
  },

  load() {
    const theme = this.data.theme
    const current = date.yearOf(date.today())
    const years = stat.availableYears()
    // 当前年即使还没有记录也要出现在年份列表里（默认停在当前年）
    if (years.indexOf(current) === -1) years.push(current)
    years.sort((a, b) => Number(b) - Number(a))
    const year = this.data.year && years.indexOf(this.data.year) > -1 ? this.data.year : current

    const overview = stat.yearlyOverview(year, theme)
    const compare = stat.yearCompare(year)

    // -- 造型分布（颜色来自 stat.shapeColor，跟随分类实体固定分配） --
    const shapeBars = overview.byShape.map((s) => ({
      key: s.shapeId,
      name: s.name,
      value: s.count,
      color: s.color,
      percentText: '(' + (Math.round(s.percent * 10) / 10) + '%)'
    }))

    // 表格视图用的行（占比提前算好，WXML 里不做方法调用）
    const shapeTable = overview.byShape.map((s) => ({
      shapeId: s.shapeId,
      name: s.name,
      count: s.count,
      color: s.color,
      percentText: (Math.round(s.percent * 10) / 10) + '%'
    }))

    // -- 月度趋势（单一度量随时间变化，柱色取校验色板的主色，
    //    固定槽位、不随数据变化） --
    const monthlyBars = overview.monthly.map((m) => ({
      label: m.month + '月',
      value: m.count,
      color: stat.shapeColor({ slot: 0 }, theme)
    }))

    // -- 营收（按售出日归属，与产量口径不同） --
    const revenueTotal = overview.revenue
    const shareText = (v) => (revenueTotal ? '(' + Math.round((v / revenueTotal) * 1000) / 10 + '%)' : '')

    const shapeRevenueBars = overview.soldByShape.map((s) => ({
      key: s.shapeId,
      name: s.name,
      value: s.amount,
      color: s.color,
      display: '¥' + money(s.amount),
      percentText: shareText(s.amount)
    }))

    // 渠道不是造型分类，但配色同样取自 stat.shapeColor 的校验色板：
    // 按渠道实体固定分配槽位，不随排名重新着色，也不循环。
    const CHANNEL_SLOT = { xhs: 0, xianyu: 1, wechat: 2, offline: 3, other: 4 }
    const channelBars = overview.byChannel.map((c) => ({
      key: c.channel,
      name: c.name,
      value: c.amount,
      color: stat.shapeColor({ slot: CHANNEL_SLOT[c.channel] == null ? 4 : CHANNEL_SLOT[c.channel] }, theme),
      display: '¥' + money(c.amount),
      percentText: shareText(c.amount)
    }))

    // -- 单件均价最高的造型（结缘溢价榜首） --
    let bestPrice = null
    overview.soldByShape.forEach((s) => {
      if (!s.quantity) return
      const price = Math.round((s.amount / s.quantity) * 100) / 100
      if (!bestPrice || price > bestPrice.price) {
        bestPrice = {
          name: s.name,
          icon: s.icon,
          iconPath: s.iconPath || '',
          price: price,
          color: s.color
        }
      }
    })

    // -- 年度对比（数量 + 增长率，PRD §5.2.1） --
    const prevYear = String(Number(year) - 1)
    const compareArrow = compare.rate == null ? '＝' : compare.rate > 0 ? '▲' : compare.rate < 0 ? '▼' : '＝'
    const compareRate =
      compare.rate == null ? '' : (compare.rate > 0 ? '+' : '') + Math.round(compare.rate) + '%'
    const compareDeltaText = Math.abs(compare.delta)

    // -- 年度代表作：当年产量最高的 2~4 条记录 --
    const soldMap = db.soldCountByCheckIn()
    const shapeMap = {}
    db.listShapes().forEach((s) => {
      shapeMap[s.id] = s
    })
    const yearRecords = db.listCheckIns({ year: year })

    // -- 最长连开天数（按打卡日连续计算） --
    let longestStreak = 0
    let run = 0
    let prevDate = ''
    const openDays = yearRecords.filter((c) => (c.count || 0) > 0).map((c) => c.date)
    Array.from(new Set(openDays))
      .sort()
      .forEach((d) => {
        run = prevDate && date.diffDays(prevDate, d) === 1 ? run + 1 : 1
        prevDate = d
        if (run > longestStreak) longestStreak = run
      })

    const works = yearRecords
      .filter((c) => (c.count || 0) > 0)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 4)
      .map((c, i) => {
        const shape = shapeMap[c.shapeId]
        const photos = db.listPhotos(c.id)
        return {
          id: c.id,
          rank: i + 1,
          cover: photos.length ? photos[0].url : '',
          icon: shape ? shape.icon : '✨',
          iconPath: shape ? shape.iconPath || '' : '',
          shapeName: shape ? shape.name : '其他',
          color: stat.shapeColor(shape, theme),
          title: c.note || (shape ? shape.name : '手作'),
          count: c.count,
          durationText: durationText(c.durationMin),
          sold: soldMap[c.id] || 0
        }
      })

    const sellRate = overview.production
      ? ((overview.soldCount / overview.production) * 100).toFixed(1)
      : '0.0'

    this.setData({
      years: years,
      year: year,
      yearIndex: years.indexOf(year),
      overview: overview,
      compare: compare,
      shapeBars: shapeBars,
      shapeTable: shapeTable,
      shapeRevenueBars: shapeRevenueBars,
      channelBars: channelBars,
      monthlyBars: monthlyBars,
      hasData: overview.production > 0,
      longestStreak: longestStreak,
      sellRate: sellRate,
      compareArrow: compareArrow,
      compareYear: prevYear.slice(2),
      compareRate: compareRate,
      compareDeltaText: compareDeltaText,
      revenueText: '¥' + money(overview.revenue),
      soldCount: overview.soldCount,
      avgPriceText: '¥' + money(overview.avgPrice),
      bestPrice: bestPrice,
      works: works
    })
  },

  onYearChange(e) {
    const year = this.data.years[Number(e.detail.value)]
    if (year) this.setData({ year: year }, () => this.load())
  },

  onPrevYear() {
    const years = this.data.years
    const i = years.indexOf(this.data.year)
    if (i > -1 && i < years.length - 1) this.setData({ year: years[i + 1] }, () => this.load())
  },

  onNextYear() {
    const years = this.data.years
    const i = years.indexOf(this.data.year)
    if (i > 0) this.setData({ year: years[i - 1] }, () => this.load())
  },

  toggleTable() {
    this.setData({ showTable: !this.data.showTable })
  },

  toggleShapeTable() {
    this.setData({ showShapeTable: !this.data.showShapeTable })
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/stats/calendar/index?year=' + this.data.year })
  },

  goCheckin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goRevenue() {
    wx.navigateTo({ url: '/pages/stats/revenue/index?year=' + this.data.year })
  },

  goWork(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/library/detail/index?id=' + id })
  }
})

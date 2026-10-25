/**
 * 统计引擎验收测试（对照 PRD §12 AC-2 / AC-3 / AC-4）
 * 运行：node test-stat.js
 */
const assert = require('assert')
const fs = require('fs')

// -- 微信 API 最小 mock --
const store = {}
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => {
    store[k] = v
  },
  removeStorageSync: (k) => {
    delete store[k]
  },
  getStorageInfoSync: () => ({ keys: Object.keys(store) }),
  showToast: () => {},
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2 })
}

const path = require('path')
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const db = require(path.join(root, 'utils/db.js'))
const stat = require(path.join(root, 'utils/stat.js'))
const date = require(path.join(root, 'utils/date.js'))

db.init()

let passed = 0
function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log('  ✓ ' + name)
  } catch (e) {
    console.log('  ✗ ' + name + '\n      ' + e.message)
    process.exitCode = 1
  }
}

console.log('\nAC-2 年度统计正确性')

// 造 3 条数据
const a = db.addCheckIn({ date: '2026-01-05', shapeId: 'shape_qq', count: 5 })
const b = db.addCheckIn({ date: '2026-03-10', shapeId: 'shape_ob11', count: 2 })
db.addCheckIn({ date: '2025-12-31', shapeId: 'shape_zhengbi', count: 1 })
db.addSale({
  checkInId: b.id,
  quantity: 1,
  unitPrice: 30,
  soldDate: '2026-05-01',
  channel: 'xhs'
})

const y26 = stat.yearlyOverview('2026', 'light')
const y25 = stat.yearlyOverview('2025', 'light')

check('2026 累计产量 = 7', () => assert.strictEqual(y26.production, 7))
check('2026 QQ人 = 5', () => {
  const s = y26.byShape.find((x) => x.shapeId === 'shape_qq')
  assert.strictEqual(s.count, 5)
})
check('2026 OB11娃头 = 2', () => {
  const s = y26.byShape.find((x) => x.shapeId === 'shape_ob11')
  assert.strictEqual(s.count, 2)
})
check('2026 分类占比 71% / 29%', () => {
  const qq = y26.byShape.find((x) => x.shapeId === 'shape_qq')
  const ob = y26.byShape.find((x) => x.shapeId === 'shape_ob11')
  assert.strictEqual(Math.round(qq.percent), 71)
  assert.strictEqual(Math.round(ob.percent), 29)
})
check('2025 累计产量 = 1', () => assert.strictEqual(y25.production, 1))
check('2025 正比 = 1', () => {
  const s = y25.byShape.find((x) => x.shapeId === 'shape_zhengbi')
  assert.strictEqual(s.count, 1)
})
check('2026 售出 1 个', () => assert.strictEqual(y26.soldCount, 1))
check('2026 营收 ¥30', () => assert.strictEqual(y26.revenue, 30))
check('2026 未售出 = 6', () => assert.strictEqual(y26.unsold, 6))
check('营收按售出日归属到 2026-05，而非打卡日 2026-03', () => {
  const mar = y26.soldMonthly.find((m) => m.month === 3)
  const may = y26.soldMonthly.find((m) => m.month === 5)
  assert.strictEqual(mar.amount, 0)
  assert.strictEqual(may.amount, 30)
})
check('2025 营收为 0（这笔不是 2025 的）', () => assert.strictEqual(y25.revenue, 0))
check('每日平均按「有记录的天数」计 = 7/2 = 3.5', () => {
  assert.strictEqual(y26.activeDays, 2)
  assert.strictEqual(y26.avgPerDay, 3.5)
})
check('单件均价 = 30', () => assert.strictEqual(y26.avgPrice, 30))

console.log('\nAC-3 售出上限')

check('售出数量上限可计算（count 2，已售 1，剩 1）', () => {
  const soldMap = db.soldCountByCheckIn()
  assert.strictEqual(soldMap[b.id], 1)
  assert.strictEqual(db.getCheckIn(b.id).count - soldMap[b.id], 1)
})
check('售出超过剩余数量会被算出负库存', () => {
  db.addSale({
    checkInId: a.id,
    quantity: 9,
    unitPrice: 10,
    soldDate: '2026-06-01',
    channel: 'other'
  })
  const over = stat.yearlyOverview('2026', 'light')
  assert.strictEqual(over.oversold, true)
  assert.strictEqual(over.unsold, 0, '未售出应按 0 显示')
  assert.ok(over.unsoldRaw < 0)
  db.removeSale(db.listSales({ year: '2026' }).find((s) => s.quantity === 9).id)
})

console.log('\nAC-4 编辑与回收站')

check('软删除后累计产量回滚', () => {
  const before = stat.yearlyOverview('2026', 'light').production
  db.softDeleteCheckIn(a.id)
  const after = stat.yearlyOverview('2026', 'light').production
  assert.strictEqual(after, before - 5)
})
check('回收站里能查到，且可恢复', () => {
  assert.ok(db.listTrash().some((c) => c.id === a.id))
  db.restoreCheckIn(a.id)
  assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 7)
})
check('永久删除（purge）后不再计入', () => {
  db.softDeleteCheckIn(a.id)
  db.purgeTrash()
  assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 2)
})

console.log('\nAC-6 空状态')

check('没有记录时不出现 NaN', () => {
  const empty = stat.yearlyOverview('1999', 'light')
  assert.strictEqual(empty.production, 0)
  assert.strictEqual(empty.avgPerDay, 0)
  assert.strictEqual(empty.revenue, 0)
  assert.strictEqual(empty.avgPrice, 0)
  assert.strictEqual(empty.byShape.length, 0)
  assert.ok(!String(empty.avgPerDay).includes('NaN'))
})

console.log('\n库存（跨年结转）')

check('库存按累计产量减累计售出', () => {
  const inv = stat.inventory('light')
  const ob = inv.find((x) => x.shapeId === 'shape_ob11')
  assert.strictEqual(ob.made, 2)
  assert.strictEqual(ob.sold, 1)
  assert.strictEqual(ob.stock, 1)
})

console.log('\n导出')

check('CSV 含表头与每条记录', () => {
  const csv = db.exportCsv()
  assert.ok(csv.indexOf('"日期","造型","数量"') > -1, '表头缺失')
  assert.ok(csv.indexOf('OB11娃头') > -1)
  assert.ok(csv.indexOf('正比') > -1)
  assert.strictEqual(csv.charCodeAt(0), 0xfeff, '应带 UTF-8 BOM 供 Excel 识别')
})
check('JSON 导出包含各集合', () => {
  const all = db.exportAll()
  assert.ok(Array.isArray(all.checkIns))
  assert.ok(Array.isArray(all.sales))
  assert.ok(Array.isArray(all.shapes))
})

console.log('\n图标资源')

check('内置分类指向的 svg 文件都存在', () => {
  const expected = {
    shape_ob11: '/assets/icons/ob11.svg',
    shape_qq: '/assets/icons/qq.svg'
  }
  Object.keys(expected).forEach((id) => {
    const s = db.listShapes().find((x) => x.id === id)
    assert.ok(s, id + ' 应存在')
    assert.strictEqual(s.iconPath, expected[id], id + ' 的 iconPath')
    assert.ok(
      fs.existsSync(path.join(root, 'assets', 'icons', path.basename(expected[id]))),
      expected[id] + ' 文件应存在'
    )
  })
})

check('老版本数据（没有 iconPath）会被回填', () => {
  // 模拟老设备：内置分类是加 iconPath 之前写入的
  const key = 'nt_db_v1'
  const old = JSON.parse(JSON.stringify(store[key] || { shapes: [] }))
  if (!old.shapes.length) old.shapes = db.listShapes().map((s) => Object.assign({}, s))
  old.shapes.forEach((s) => {
    if (s.id === 'shape_ob11' || s.id === 'shape_qq') delete s.iconPath
  })
  store[key] = old

  // 清模块缓存，重新 init 走一遍升级路径
  const dbPath = path.join(root, 'utils/db.js')
  delete require.cache[require.resolve(dbPath)]
  const dbFresh = require(dbPath)
  dbFresh.init()
  const s = dbFresh.listShapes().find((x) => x.id === 'shape_ob11')
  assert.ok(s.iconPath, '老数据应被回填 iconPath')
  assert.strictEqual(s.name, 'OB11娃头', '用户改过的名字不能被覆盖')
})

console.log('\n' + (process.exitCode ? '存在失败用例' : passed + ' 个用例全部通过') + '\n')

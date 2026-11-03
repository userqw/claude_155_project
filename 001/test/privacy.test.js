/**
 * 隐私验收测试（PRD §5.6.1：数据是私有的，但不拦截）
 *
 * 运行：node test/privacy.test.js
 *
 * 未登录时，界面上不能出现任何属于用户的内容——数字、记录、作品、
 * 素材、品类、标签，一律按空处理。这个测试逐页走一遍，
 * 防止新增页面时漏掉这道拦截。
 */
const assert = require('assert')
const path = require('path')

// -- 微信 API mock ----------------------------------------------------------
const store = {}
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v },
  removeStorageSync: (k) => { delete store[k] },
  getStorageInfoSync: () => ({ keys: Object.keys(store), currentSize: 1, totalSize: 1 }),
  showToast: () => {},
  showModal: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2, platform: 'ios' })
}
global.getApp = () => ({ globalData: { theme: 'light', cloudEnabled: false } })
global.getCurrentPages = () => [{}]

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const db = require(path.join(root, 'utils/db.js'))
const auth = require(path.join(root, 'utils/auth.js'))
db.init()
auth.init()

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log('  ✓ ' + name)
  } catch (e) {
    failed += 1
    console.log('  ✗ ' + name + '\n      ' + e.message)
    process.exitCode = 1
  }
}

/** 加载一个页面并造一个实例 */
function loadPage(rel) {
  let def = null
  global.Page = (d) => { def = d }
  const p = path.join(root, rel)
  delete require.cache[require.resolve(p)]
  require(p)
  const inst = Object.assign({}, def, { data: Object.assign({}, def.data) })
  inst.setData = (patch) => {
    Object.keys(patch).forEach((k) => {
      if (k.indexOf('.') > -1) {
        const [a, b] = k.split('.')
        inst.data[a] = Object.assign({}, inst.data[a], { [b]: patch[k] })
      } else {
        inst.data[k] = patch[k]
      }
    })
  }
  return inst
}

// 造一些数据：一条打卡、一笔售出、一个素材
// addCheckIn 返回的是记录对象，不是 id
const rec = db.addCheckIn({ date: '2026-06-01', shapeId: 'shape_qq', count: 7, note: '私密记录' })
const recId = rec.id
db.addSale({ checkInId: recId, quantity: 2, unitPrice: 30, soldDate: '2026-06-02' })
db.addFolder('私密文件夹')
db.addMaterials('', [{ url: 'wxfile://tmp_p.jpg', name: '私密素材' }])

async function main() {
  console.log('\n未登录时各页面都不能露出用户内容')

  await check('首页：累计捏制 / 已售总额 / 最近记录 / 连续天数都是空的', () => {
    const page = loadPage('pages/index/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.overview.production, 0, '累计捏制')
    assert.strictEqual(page.data.overview.revenue, 0, '已售总额')
    assert.strictEqual(page.data.recent.length, 0, '最近记录')
    assert.ok(!/[0-9]/.test(page.data.statusText), '状态条：' + page.data.statusText)
  })

  await check('作品库：记录、照片、数量都是空的', () => {
    const page = loadPage('pages/library/list/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.left.length, 0)
    assert.strictEqual(page.data.right.length, 0)
    assert.strictEqual(page.data.counts.total, 0)
  })

  await check('作品详情：看不到那条记录', () => {
    const page = loadPage('pages/library/detail/index.js')
    auth.logout()
    page.setData({ id: recId })
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.record, null)
    assert.strictEqual(page.data.photos.length, 0)
    assert.strictEqual(page.data.sales.length, 0)
  })

  await check('年度统计：产量、营收、代表作、分类占比都是空的', () => {
    const page = loadPage('pages/stats/year/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.overview.production, 0)
    assert.strictEqual(page.data.overview.revenue, 0)
    assert.strictEqual(page.data.works.length, 0, '年度代表作')
    assert.strictEqual(page.data.shapeBars.length, 0, '分类占比')
    assert.strictEqual(page.data.longestStreak, 0, '最长连开')
  })

  await check('营收页：金额与渠道占比都是空的', () => {
    const page = loadPage('pages/stats/revenue/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.sales.length, 0)
    assert.strictEqual(page.data.revenueBars.length, 0)
    assert.strictEqual(page.data.channelBars.length, 0)
  })

  await check('日历页：热力图与当天记录都是空的', () => {
    const page = loadPage('pages/stats/calendar/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.total, 0)
    assert.strictEqual(page.data.activeDays, 0)
    assert.strictEqual(page.data.dayRecords.length, 0)
    // 每个格子都得是空的，不能带着真实产量
    const cells = page.data.months.reduce((n, m) => n + m.cells.length, 0)
    const hot = page.data.months.reduce(
      (n, m) => n + m.cells.filter((c) => c.count > 0).length,
      0
    )
    assert.ok(cells > 0, '格子还是要渲染出来，不然日历是坏的')
    assert.strictEqual(hot, 0, '不该有任何一个格子带产量')
  })

  await check('我的页：累计、库存、回收站数量、标签名都是空的', () => {
    const page = loadPage('pages/mine/index/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.totals.production, 0, '累计捏制')
    assert.strictEqual(page.data.totals.revenue, 0, '营收')
    assert.strictEqual(page.data.totals.records, 0, '记录条数')
    assert.strictEqual(page.data.inventory.length, 0, '库存明细')
    assert.strictEqual(page.data.trashCount, 0, '回收站数量')
    assert.strictEqual(page.data.tagNames, '', '标签名')
    assert.strictEqual(page.data.materialPreviews.length, 0, '素材预览')
  })

  await check('账号设置：本机记录条数不给看', () => {
    const page = loadPage('pages/mine/account/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.localCount, 0)
  })

  await check('素材库：文件夹、素材、数量都是空的', () => {
    const page = loadPage('pages/material/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.folders.length, 0)
    assert.strictEqual(page.data.materials.length, 0)
    assert.strictEqual(page.data.counts.total, 0)
  })

  await check('品类管理：品类名与「已记录 N 个」都是空的', () => {
    const page = loadPage('pages/mine/shapes/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.shapes.length, 0)
  })

  await check('标签库：标签名与「用了 N 条」都是空的', () => {
    const page = loadPage('pages/mine/tags/index.js')
    auth.logout()
    page.load()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.tags.length, 0)
  })

  await check('导出页：数据概况是空的，也不许导出', () => {
    const page = loadPage('pages/mine/export/index.js')
    auth.logout()
    page.refresh()
    assert.strictEqual(page.data.locked, true)
    assert.strictEqual(page.data.counts.records, 0)
    assert.strictEqual(page.data.counts.sales, 0)
  })

  await check('售出要登录：未登录时打不开售出面板', () => {
    auth.logout()
    // 记售出的入口在作品详情页（首页那条记录只显示状态）
    const page = loadPage('pages/library/detail/index.js')
    page.setData({
      id: recId,
      unsold: 3,
      record: { id: recId, shape: { name: 'QQ人' } }
    })
    const calls = []
    global.wx.navigateTo = (o) => calls.push(o)
    try {
      page.onSell()
      assert.ok(
        calls.some((c) => c.url && c.url.indexOf('/pages/login/index') === 0),
        '应当被带到登录页，实际：' + JSON.stringify(calls)
      )
      assert.strictEqual(page.data.showSale, false, '不该打开售出面板')
    } finally {
      global.wx.navigateTo = () => {}
    }
  })

  await check('未登录时记录上没有售出状态', () => {
    auth.logout()
    const page = loadPage('pages/index/index.js')
    page.load()
    assert.strictEqual(page.data.recent.length, 0, '记录本身就没有，售出状态自然也没有')
  })

  console.log('\n登录后照常可见')

  await check('登录后数字与记录都回来了', () => {
    auth.devLogin()
    const home = loadPage('pages/index/index.js')
    home.load()
    assert.ok(home.data.overview.production > 0, '登录后应能看到累计捏制')
    assert.ok(home.data.recent.length > 0, '登录后应能看到最近记录')

    const mine = loadPage('pages/mine/index/index.js')
    mine.load()
    assert.ok(mine.data.totals.production > 0, '登录后应能看到累计')
    assert.ok(mine.data.inventory.length > 0, '登录后应能看到库存明细')
  })

  await check('退出登录后数据还在，只是藏起来了', () => {
    auth.logout()
    const home = loadPage('pages/index/index.js')
    home.load()
    assert.strictEqual(home.data.overview.production, 0, '退出后不该露')
    assert.strictEqual(db.aliveCheckIns().length, 1, '本机数据一条不少')
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main()

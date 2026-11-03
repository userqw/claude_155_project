/**
 * 导航栏验收测试（底部 tab bar + 登录页返回 + 登录页不会卡住）
 *
 * 运行：node test/nav.test.js
 *
 * 盯的是两件「点了没反应 / 没反应了」的事：
 *   1. 自定义 tab bar 的每个 tab 都要能 switchTab 过去——
 *      路径必须真的在 app.json 的 tabBar.list 里，否则 wx.switchTab
 *      直接失败，表现为「点了底部导航栏毫无动静」。
 *   2. 登录页不是 tab 页，卡在上面就看不到底部导航栏；
 *      返回必须兜底回首页，不能把用户困住。
 *   3. 后端不响应时，登录页必须自己从「处理中…」里出来——
 *      真机上请求挂起时微信的 timeout 并不保证回调，
 *      没有自己的兜底就会永久卡住。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

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

// -- 加载自定义 tab bar 组件 --------------------------------------------------
let tabBarDef = null
const wxCalls = []
const wxRequests = []

global.Component = (def) => { tabBarDef = def }
global.wx = {
  switchTab: (o) => { wxCalls.push({ type: 'switchTab', ...o }) },
  navigateTo: (o) => { wxCalls.push({ type: 'navigateTo', ...o }) },
  redirectTo: (o) => { wxCalls.push({ type: 'redirectTo', ...o }) },
  navigateBack: (o) => { wxCalls.push({ type: 'navigateBack', ...o }) },
  // 探活请求：只记录，不回调 —— 模拟「连接挂起」
  request: (opt) => { wxRequests.push(opt) }
}

require(path.join(root, 'custom-tab-bar/index.js'))

/** 造一个组件实例（只要 methods 和 data 够用） */
function makeTabBar(selected) {
  const inst = Object.assign({}, tabBarDef.methods, {
    data: Object.assign({}, tabBarDef.data, { selected })
  })
  inst.setData = (patch) => Object.assign(inst.data, patch)
  return inst
}

// -- 加载登录页 --------------------------------------------------------------
let pageDef = null
const store = {}
global.Page = (def) => { pageDef = def }
global.getApp = () => ({ globalData: { theme: 'light' } })
global.getCurrentPages = () => global.__pageStack || []
global.wx = Object.assign(global.wx, {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v },
  removeStorageSync: (k) => { delete store[k] },
  getStorageInfoSync: () => ({ keys: Object.keys(store), currentSize: 0, totalSize: 0 }),
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2, platform: 'devtools' }),
  showToast: () => {},
  showModal: () => {},
  showLoading: () => {},
  hideLoading: () => {}
})

require(path.join(root, 'pages/login/index.js'))

function makePage() {
  const inst = Object.assign({}, pageDef, { data: Object.assign({}, pageDef.data) })
  inst.setData = (patch) => Object.assign(inst.data, patch)
  return inst
}

async function main() {
  console.log('\n底部 tab bar')

  await check('组件注册成功', () => {
    assert.ok(tabBarDef, 'custom-tab-bar 应该调用 Component()')
    assert.ok(tabBarDef.methods && tabBarDef.methods.onTap, '应该有 onTap')
  })

  await check('每个 tab 的路径都在 app.json 的 tabBar.list 里（否则 switchTab 会静默失败）', () => {
    const listed = (appJson.tabBar.list || []).map((t) => '/' + t.pagePath)
    tabBarDef.data.list.forEach((item) => {
      assert.ok(
        listed.indexOf(item.pagePath) > -1,
        item.pagePath + ' 不在 app.json 的 tabBar.list 里 —— wx.switchTab 会失败，点了没反应'
      )
    })
  })

  await check('wx:key 指向的字段真的存在于列表项里', () => {
    const wxml = fs.readFileSync(path.join(root, 'custom-tab-bar/index.wxml'), 'utf8')
    const m = wxml.match(/wx:key="([^"]+)"/)
    assert.ok(m, 'wxml 应该有 wx:key')
    const key = m[1]
    tabBarDef.data.list.forEach((item) => {
      assert.ok(key in item, 'wx:key="' + key + '" 但列表项里没有这个字段（实际字段：' + Object.keys(item).join(',') + '）')
    })
  })

  await check('点某个 tab 会 switchTab 到对应页面', () => {
    const bar = makeTabBar(0)
    wxCalls.length = 0
    bar.onTap({ currentTarget: { dataset: { index: 2, path: '/pages/library/list/index' } } })
    assert.strictEqual(wxCalls.length, 1)
    assert.strictEqual(wxCalls[0].type, 'switchTab')
    assert.strictEqual(wxCalls[0].url, '/pages/library/list/index')
  })

  await check('点当前已选中的 tab 不会重复跳转', () => {
    const bar = makeTabBar(1)
    wxCalls.length = 0
    bar.onTap({ currentTarget: { dataset: { index: 1, path: '/pages/stats/year/index' } } })
    assert.strictEqual(wxCalls.length, 0, '点当前 tab 不该跳转')
  })

  await check('每个 tab 都能跳（逐个点一遍）', () => {
    tabBarDef.data.list.forEach((item, i) => {
      const bar = makeTabBar(-1)
      wxCalls.length = 0
      bar.onTap({ currentTarget: { dataset: { index: i, path: item.pagePath } } })
      assert.strictEqual(wxCalls.length, 1, item.text + ' 点不动')
      assert.strictEqual(wxCalls[0].url, item.pagePath)
    })
  })

  console.log('\n登录页返回')

  await check('登录页不是 tab 页（所以必须能返回到有导航栏的页面）', () => {
    assert.ok(
      (appJson.tabBar.list || []).every((t) => t.pagePath !== 'pages/login/index'),
      '登录页不该在 tabBar.list 里'
    )
  })

  await check('页面栈只有登录页时，返回会 switchTab 回首页', () => {
    global.__pageStack = [{}]
    const page = makePage()
    wxCalls.length = 0
    page.back()
    assert.strictEqual(wxCalls.length, 1)
    assert.strictEqual(wxCalls[0].type, 'switchTab')
    assert.strictEqual(wxCalls[0].url, '/pages/index/index')
  })

  await check('navigateBack 失败时兜底回首页（不能把用户困在没有导航栏的页面上）', () => {
    global.__pageStack = [{}, {}]
    const page = makePage()
    wxCalls.length = 0
    page.back()
    assert.strictEqual(wxCalls[0].type, 'navigateBack')
    // 模拟 navigateBack 失败
    if (typeof wxCalls[0].fail === 'function') wxCalls[0].fail({ errMsg: 'navigateBack:fail' })
    const fallback = wxCalls.find((c) => c.type === 'switchTab')
    assert.ok(fallback, 'navigateBack 失败后应该兜底 switchTab 回首页')
    assert.strictEqual(fallback.url, '/pages/index/index')
  })

  console.log('\n登录页的主按钮文案')

  const auth = require(path.join(root, 'utils/auth'))
  auth.init()

  await check('没登录时主按钮是「微信一键登录」', () => {
    const page = makePage()
    page.onLoad({})
    assert.strictEqual(page.data.actionText, '微信一键登录')
  })

  await check('已登录时从账号设置进来是「保存资料」', () => {
    auth.devLogin()
    const page = makePage()
    page.onLoad({})
    assert.strictEqual(page.data.actionText, '保存资料')
  })

  await check('已登录时从「我的 → 微信一键登录」进来是「登录」', () => {
    // 这一条是踩过的坑：本地已有登录态时，按钮显示成「保存资料」，
    // 点下去只是把资料再存一遍，看着就像登录没生效、账号反倒没了
    auth.devLogin()
    const page = makePage()
    page.onLoad({ intent: 'login' })
    assert.strictEqual(page.data.actionText, '登录')
  })

  await check('「我的」页的一键登录入口带着 intent=login', () => {
    const src = fs.readFileSync(path.join(root, 'pages/mine/index/index.js'), 'utf8')
    assert.ok(src.indexOf('/pages/login/index?intent=login') > -1,
      '「我的」页跳登录页要带 intent=login，否则按钮会显示成「保存资料」')
  })

  console.log('\n打卡要登录')

  // 加载首页与打卡页
  let homeDef = null
  global.Page = (def) => { homeDef = def }
  require(path.join(root, 'pages/index/index.js'))
  const home = Object.assign({}, homeDef, { data: Object.assign({}, homeDef.data) })
  home.setData = (patch) => Object.assign(home.data, patch)

  let checkinDef = null
  global.Page = (def) => { checkinDef = def }
  require(path.join(root, 'pages/checkin/index.js'))
  const checkin = Object.assign({}, checkinDef, { data: Object.assign({}, checkinDef.data) })
  checkin.setData = (patch) => Object.assign(checkin.data, patch)

  await check('未登录点「去打卡」→ 带到登录页，并带上登录完要接着去的地址', () => {
    auth.logout()
    wxCalls.length = 0
    home.onTapCheckin()
    assert.strictEqual(wxCalls.length, 1)
    assert.strictEqual(wxCalls[0].type, 'navigateTo')
    assert.ok(wxCalls[0].url.indexOf('/pages/login/index') === 0, wxCalls[0].url)
    assert.ok(wxCalls[0].url.indexOf('intent=login') > -1, '要明确是来登录的：' + wxCalls[0].url)
    assert.ok(
      decodeURIComponent(wxCalls[0].url).indexOf('/pages/checkin/index') > -1,
      '登录完要接着去打卡页：' + wxCalls[0].url
    )
  })

  await check('已登录点「去打卡」→ 直接进打卡页', () => {
    auth.devLogin()
    wxCalls.length = 0
    home.onTapCheckin()
    assert.strictEqual(wxCalls.length, 1)
    assert.strictEqual(wxCalls[0].type, 'navigateTo')
    assert.strictEqual(wxCalls[0].url, '/pages/checkin/index')
  })

  await check('打卡页被直接打开时也要先登录（作品库详情 / 日历补录进来的）', () => {
    auth.logout()
    wxCalls.length = 0
    checkin.onLoad({ id: 'ci_x' })
    assert.strictEqual(wxCalls.length, 1)
    assert.strictEqual(wxCalls[0].type, 'redirectTo', '要用 redirectTo 把本页顶掉，页面栈才不会越叠越深')
    assert.ok(wxCalls[0].url.indexOf('/pages/login/index') === 0, wxCalls[0].url)
    assert.ok(
      decodeURIComponent(wxCalls[0].url).indexOf('id=ci_x') > -1,
      '登录完要回到原来那条记录，参数不能丢：' + wxCalls[0].url
    )
  })

  console.log('\n首页的数字是私有的（未登录不给看）')

  await check('未登录：累计捏制、已售总额、最近记录都是空的', () => {
    const db = require(path.join(root, 'utils/db.js'))
    db.addCheckIn({ date: '2026-06-01', shapeId: 'shape_qq', count: 7 })
    db.addSale({
      checkInId: db.listCheckIns()[0].id,
      quantity: 1,
      unitPrice: 30,
      soldDate: '2026-06-02'
    })

    auth.logout()
    home.load()
    assert.strictEqual(home.data.overview.production, 0, '累计捏制不该露')
    assert.strictEqual(home.data.overview.revenue, 0, '已售总额不该露')
    assert.strictEqual(home.data.recent.length, 0, '最近记录不该露')
    assert.ok(
      !/[0-9]/.test(home.data.statusText),
      '状态条里也不该有数字：' + home.data.statusText
    )
  })

  await check('登录后：数字照常显示', () => {
    auth.devLogin()
    home.load()
    assert.ok(home.data.overview.production > 0, '登录后应能看到累计捏制')
    assert.ok(home.data.recent.length > 0, '登录后应能看到最近记录')
  })

  console.log('\n首页记录只显示一个状态')

  await check('卖了一部分也算「未售」，全部卖完才算「售出」', () => {
    const db = require(path.join(root, 'utils/db.js'))
    auth.devLogin()
    // 显式加载首页：上面几节最后加载的是别的页面，makePage() 拿到的不一定是它
    let homeDef = null
    global.Page = (def) => { homeDef = def }
    const homePath = path.join(root, 'pages/index/index.js')
    delete require.cache[require.resolve(homePath)]
    require(homePath)
    const page = Object.assign({}, homeDef, { data: Object.assign({}, homeDef.data) })
    page.setData = (patch) => Object.assign(page.data, patch)

    const unsoldRec = db.addCheckIn({ date: '2026-07-01', shapeId: 'shape_qq', count: 3 })
    const partialRec = db.addCheckIn({ date: '2026-07-02', shapeId: 'shape_qq', count: 3 })
    const soldRec = db.addCheckIn({ date: '2026-07-03', shapeId: 'shape_qq', count: 2 })

    // 部分售出：3 个里卖了 1 个
    db.addSale({ checkInId: partialRec.id, quantity: 1, unitPrice: 10, soldDate: '2026-07-04' })
    // 全部售出
    db.addSale({ checkInId: soldRec.id, quantity: 2, unitPrice: 10, soldDate: '2026-07-04' })

    const page2 = page
    page2.load()
    const byId = {}
    page2.data.recent.forEach((r) => { byId[r.id] = r })

    assert.strictEqual(byId[unsoldRec.id].fullySold, false, '没卖过的不是售出')
    assert.strictEqual(byId[partialRec.id].fullySold, false, '卖了一部分仍是未售')
    assert.strictEqual(byId[partialRec.id].sold, 1)
    assert.strictEqual(byId[partialRec.id].unsold, 2)
    assert.strictEqual(byId[soldRec.id].fullySold, true, '全卖完才是售出')
    assert.strictEqual(byId[soldRec.id].unsold, 0)
  })

  await check('记录行里只有一个状态徽标，没有第二个「售出」', () => {
    const wxml = require('fs').readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
    const row = wxml.split('wx:for="{{recent}}"')[1] || ''
    const badges = (row.match(/<badge/g) || []).length
    assert.strictEqual(badges, 1, '一条记录只能有一个状态徽标，实际 ' + badges + ' 个')
    assert.strictEqual(row.indexOf('record-sell'), -1,
      '记录行里不该再有「售出」按钮——它和状态徽标并排显示，看着像两个状态')
  })

  console.log('\n登录页不会卡在「处理中…」')

  await check('请求挂起不回调时，loading 会被清掉并给出提示', async () => {
    // wx.request 只记录、从不回调——正是真机上「连接挂起」时的样子。
    // 微信自己的 timeout 在这种情况下不保证回调，所以前端必须有自己的兜底。
    let hanging = true
    global.wx.request = (opt) => {
      wxRequests.push(opt)
      if (!hanging) {
        // 后面的候选地址立刻失败，别让测试白等一轮超时
        opt.fail({ errMsg: 'request:fail' })
      }
    }
    try {
      const page = makePage()
      page.setData({ agreed: true })
      const started = Date.now()
      await page.onLogin()
      const waited = Date.now() - started
      assert.strictEqual(page.data.loading, false, 'loading 必须被清掉，不能停在「处理中…」')
      assert.ok(page.data.errorMessage, '应该给出错误提示：' + page.data.errorMessage)
      assert.ok(waited < 30000, '应该自己超时退出，而不是一直等（实际等了 ' + waited + 'ms）')
    } finally {
      hanging = false
    }
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main()

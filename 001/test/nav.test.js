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

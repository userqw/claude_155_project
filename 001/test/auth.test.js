/**
 * 账号与登录验收测试（对照 PRD §12 的 AC-8 ~ AC-12）
 * 运行：node test/auth.test.js
 */
const assert = require('assert')
const path = require('path')

// -- 微信 API mock ----------------------------------------------------------
const store = {}
let loginCodeCalls = 0
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
  showModal: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  navigateTo: () => {},
  switchTab: () => {},
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2 }),
  login: (opt) => {
    loginCodeCalls += 1
    opt.success({ code: 'mock_code_' + loginCodeCalls })
  }
}

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const db = require(path.join(root, 'utils/db.js'))
const auth = require(path.join(root, 'utils/auth.js'))
const stat = require(path.join(root, 'utils/stat.js'))

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

async function main() {
  console.log('\nAC-8 游客模式可用性')

  await check('新用户未做过选择时提示一次引导', () => {
    assert.strictEqual(auth.shouldShowPrompt(), true)
    assert.strictEqual(auth.isLoggedIn(), false)
  })

  await check('游客模式下打卡照常保存，统计正确', () => {
    db.addCheckIn({ date: '2026-03-01', shapeId: 'shape_qq', count: 2 })
    db.addCheckIn({ date: '2026-03-02', shapeId: 'shape_ob11', count: 3 })
    const y = stat.yearlyOverview('2026', 'light')
    assert.strictEqual(y.production, 5)
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  await check('关闭引导条后不再提示', () => {
    auth.dismissPrompt()
    assert.strictEqual(auth.shouldShowPrompt(), false)
  })

  await check('账号模块不做任何页面拦截（浏览永不被强制）', () => {
    const src = require('fs').readFileSync(path.join(root, 'utils/auth.js'), 'utf8')
    assert.strictEqual(src.indexOf('navigateTo') > -1, false, 'auth 不应做页面跳转')
    assert.strictEqual(src.indexOf('redirectTo') > -1, false)
    assert.strictEqual(src.indexOf('showModal') > -1, false)
  })

  console.log('\nAC-9 跳过选项')

  await check('跳过 → 进入游客模式，引导条不再出现', () => {
    auth.skipLogin()
    const s = auth.getState()
    assert.strictEqual(s.mode, 'guest')
    assert.strictEqual(s.skippedLogin, true)
    assert.strictEqual(auth.shouldShowPrompt(), false)
  })

  await check('跳过不影响已有本地数据', () => {
    assert.strictEqual(db.aliveCheckIns().length, 2)
    assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 5)
  })

  console.log('\nAC-12 浏览不被强制')

  await check('后端未配置时登录失败，但不破坏任何本地数据', async () => {
    assert.strictEqual(auth.backendReady(), false)
    const res = await auth.login()
    assert.strictEqual(res.ok, false)
    assert.strictEqual(res.error, 'NOT_CONFIGURED')
    assert.strictEqual(auth.isLoggedIn(), false)
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  console.log('\nAC-10 登录后数据不丢')

  await check('登录后本地记录一条不少', async () => {
    auth.devLogin()
    assert.strictEqual(auth.isLoggedIn(), true)
    assert.strictEqual(db.aliveCheckIns().length, 2)
    assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 5)
  })

  await check('合并是幂等的，重复合并不产生重复记录', async () => {
    const before = db.aliveCheckIns().length
    const r1 = await auth.mergeLocalToAccount()
    const r2 = await auth.mergeLocalToAccount()
    assert.strictEqual(r1.ok, true)
    assert.strictEqual(r2.ok, true)
    assert.strictEqual(db.aliveCheckIns().length, before, '记录数不应变化')
  })

  await check('未配置后端时合并不算失败，本地数据保留', async () => {
    const res = await auth.mergeLocalToAccount()
    assert.strictEqual(res.ok, true)
    assert.strictEqual(res.skipped, true)
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  await check('更新昵称头像在后端未配时也只落本地', async () => {
    const res = await auth.updateProfile({ nickname: '小陶', avatarUrl: 'https://x/a.png' })
    assert.strictEqual(res.ok, true)
    assert.strictEqual(auth.getState().account.nickname, '小陶')
  })

  console.log('\nAC-11 退出与注销')

  await check('退出登录 → 回到游客模式，本地记录一条不少', () => {
    auth.logout()
    assert.strictEqual(auth.isLoggedIn(), false)
    assert.strictEqual(auth.getState().account, null)
    assert.strictEqual(db.aliveCheckIns().length, 2)
    assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 5)
  })

  await check('退出登录后不再弹引导条', () => {
    assert.strictEqual(auth.shouldShowPrompt(), false)
  })

  await check('注销账号 → 本机数据被清空', async () => {
    auth.devLogin()
    const res = await auth.deleteAccount()
    assert.strictEqual(res.ok, true)
    assert.strictEqual(db.aliveCheckIns().length, 0)
    assert.strictEqual(db.listSales().length, 0)
    assert.strictEqual(auth.isLoggedIn(), false)
  })

  await check('注销后分类与标签回到内置默认值', () => {
    assert.strictEqual(db.listShapes().length, 4)
    assert.strictEqual(db.listTags().length, 6)
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main()

/**
 * 账号与登录验收测试（对照 PRD §12 的 AC-8 ~ AC-12）
 *
 * 运行：node test/auth.test.js
 *
 * 后端现在是配好的（001/utils/config.js 的 apiBase 指向 005 的服务），
 * 所以这里用两种后端状态来覆盖：
 *   backendUp = false  → 后端不可达（网络失败 / 服务没起）
 *   backendUp = true   → 后端可达（内存里的假后端）
 */
const assert = require('assert')
const path = require('path')

// -- 微信 API mock ----------------------------------------------------------
const store = {}
let loginCodeCalls = 0
let backendUp = false
let lastRequest = null

/** 内存假后端：够前端跑通登录/资料/推送三条链路 */
function fakeBackend(pathname, body) {
  if (pathname === '/api/login') {
    return {
      code: 0,
      message: 'ok',
      data: {
        token: 'mock_token_' + Date.now(),
        account: {
          openid: 'mock_openid',
          unionid: null,
          nickname: (body && body.nickname) || null,
          avatarUrl: (body && body.avatarUrl) || null,
          createdAt: '2026-01-01T00:00:00'
        },
        newUser: true,
        expireSeconds: 3600
      }
    }
  }
  if (pathname === '/api/profile') {
    return {
      code: 0,
      message: 'ok',
      data: {
        account: {
          openid: 'mock_openid',
          unionid: null,
          nickname: (body && body.nickname) || null,
          avatarUrl: (body && body.avatarUrl) || null,
          createdAt: '2026-01-01T00:00:00'
        }
      }
    }
  }
  if (pathname === '/api/sync/push') {
    return { code: 0, message: 'ok', data: { checkIns: 1, photos: 0, sales: 0, folders: 0, materials: 0 } }
  }
  return { code: 0, message: 'ok', data: {} }
}

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
  },
  request: (opt) => {
    lastRequest = opt
    if (!backendUp) {
      // 后端不可达
      opt.fail({ errMsg: 'request:fail' })
      return
    }
    const pathname = opt.url.replace(/^https?:\/\/[^/]+/, '')
    const body = opt.data ? JSON.parse(JSON.stringify(opt.data)) : null
    opt.success({ statusCode: 200, data: fakeBackend(pathname, body) })
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

  await check('后端不可达时登录失败，但不破坏任何本地数据', async () => {
    backendUp = false
    const res = await auth.login()
    assert.strictEqual(res.ok, false)
    assert.strictEqual(res.error, 'NETWORK')
    assert.strictEqual(auth.isLoggedIn(), false)
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  console.log('\nAC-10 登录后数据不丢')

  await check('后端可达时登录成功，拿到 token 与 account', async () => {
    backendUp = true
    const res = await auth.login()
    assert.strictEqual(res.ok, true, JSON.stringify(res))
    assert.strictEqual(auth.isLoggedIn(), true)
    assert.ok(auth.getState().token)
    assert.strictEqual(auth.getState().account.openid, 'mock_openid')
  })

  await check('登录后本地记录一条不少', () => {
    assert.strictEqual(db.aliveCheckIns().length, 2)
    assert.strictEqual(stat.yearlyOverview('2026', 'light').production, 5)
  })

  await check('登录请求本身不带 Authorization 头', () => {
    // 登录接口不需要 token，带了反而多余
    assert.strictEqual(lastRequest.url.indexOf('/api/login') > -1, true)
    assert.strictEqual(lastRequest.header.Authorization, undefined)
  })

  await check('合并是幂等的，重复合并不产生重复记录', async () => {
    const before = db.aliveCheckIns().length
    const r1 = await auth.mergeLocalToAccount()
    const r2 = await auth.mergeLocalToAccount()
    assert.strictEqual(r1.ok, true)
    assert.strictEqual(r2.ok, true)
    assert.strictEqual(db.aliveCheckIns().length, before, '记录数不应变化')
  })

  await check('上传的报文是后端能解析的形状', () => {
    const push = lastRequest.data
    assert.ok(push.deviceId, '应有 deviceId')
    assert.ok(Array.isArray(push.checkIns), '应有 checkIns 数组')
    assert.ok(Array.isArray(push.sales), '应有 sales 数组')
    assert.ok(Array.isArray(push.photos), '应有 photos 数组')
    assert.ok(Array.isArray(push.folders), '应有 folders 数组')
    assert.ok(Array.isArray(push.materials), '应有 materials 数组')
    assert.strictEqual(push.token, undefined, 'token 走 Authorization 头，不放 body')
  })

  await check('带 Authorization 头发请求（登录之后的接口）', () => {
    assert.ok(lastRequest.header.Authorization, '请求头应带 token')
    assert.strictEqual(lastRequest.header.Authorization.indexOf('Bearer '), 0)
  })

  await check('时间戳转成了 ISO 字符串（后端 LocalDateTime 不接受裸毫秒数）', () => {
    const ci = lastRequest.data.checkIns[0]
    assert.strictEqual(typeof ci.createdAt, 'string', 'createdAt 应为字符串')
    assert.strictEqual(isNaN(Date.parse(ci.createdAt)), false, '应能解析成时间')
    assert.strictEqual(typeof ci.updatedAt, 'string')
  })

  await check('更新昵称头像能落到后端', async () => {
    const res = await auth.updateProfile({ nickname: '小陶', avatarUrl: 'https://x/a.png' })
    assert.strictEqual(res.ok, true)
    assert.strictEqual(auth.getState().account.nickname, '小陶')
  })

  console.log('\nAC-11 退出与注销')

  await check('退出登录回到游客模式，本地记录一条不少', () => {
    auth.logout()
    assert.strictEqual(auth.getState().mode, 'guest')
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

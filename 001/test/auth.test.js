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
// 失败时微信给的原始 errMsg（不同原因长得完全不一样，不能一律吞成「网络连接失败」）
let failErrMsg = 'request:fail'
// 只让这些主机有响应；为空表示跟随 backendUp。用来测多地址探活。
let upHosts = null
// 让下一个「带 token 的请求」返回 401（模拟 token 过期）
let expireAuthed = false
// 让下一个「带 token 的请求」返回「账号已注销」
let deleteAccount = false
let tokenSeq = 0

/** 内存假后端：够前端跑通登录/资料/推送三条链路 */
function fakeBackend(pathname, body) {
  if (pathname === '/api/login') {
    return {
      code: 0,
      message: 'ok',
      data: {
        token: 'mock_token_' + (++tokenSeq),
        account: {
          openid: 'mock_openid',
          unionid: null,
          nickname: (body && body.nickname) || null,
          avatarUrl: (body && body.avatarUrl) || null,
          createdAt: '2026-01-01T00:00:00'
        },
        newUser: true,
        expireSeconds: 3600,
        // 后端没配 appid/secret 时会带这个标记：
        // openid 是 md5(code) 编的，不是用户的真实微信号
        mock: true
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
  if (pathname === '/api/health') {
    return { code: 0, message: 'ok', data: 'ok' }
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
    const host = opt.url.replace(/^https?:\/\//, '').split('/')[0]
    const alive = upHosts && upHosts.size ? upHosts.has(host) : backendUp
    if (!alive) {
      // 后端不可达
      opt.fail({ errMsg: failErrMsg })
      return
    }
    const authed = !!(opt.header && opt.header.Authorization)
    if (authed && deleteAccount) {
      deleteAccount = false
      opt.success({ statusCode: 200, data: { code: 401, message: '账号不存在或已注销，请重新登录' } })
      return
    }
    if (authed && expireAuthed) {
      expireAuthed = false
      opt.success({ statusCode: 200, data: { code: 401, message: '登录已过期，请重新登录' } })
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

  console.log('\n昵称随登录一起提交')

  await check('登录请求就带上昵称头像（不用登录完再补一次）', async () => {
    const res = await auth.login({ nickname: '小陶酱', avatarUrl: 'https://x/b.png' })
    assert.strictEqual(res.ok, true)
    assert.strictEqual(lastRequest.data.nickname, '小陶酱')
    assert.strictEqual(lastRequest.data.avatarUrl, 'https://x/b.png')
  })

  await check('登录后本地就拿到了昵称', () => {
    assert.strictEqual(auth.getState().account.nickname, '小陶酱')
  })

  await check('后端在 mock 模式时会把标记带回来（openid 不是真实微信号）', async () => {
    assert.strictEqual(auth.getState().mock, true)
    const res = await auth.login()
    assert.strictEqual(res.mock, true)
  })

  console.log('\nAC-11 退出与注销')

  await check('退出登录回到游客模式，本地记录一条不少', () => {
    auth.logout()
    assert.strictEqual(auth.getState().mode, 'guest')
    assert.strictEqual(db.aliveCheckIns().length, 2)
  })

  console.log('\n连不上后端时的诊断信息')

  await check('失败原因会翻译成人话，不再只有「网络连接失败」', async () => {
    // 微信在地址不合法时给的是 url not in domain list，
    // 之前被一律吞成「网络连接失败」，用户根本看不出该改什么。
    backendUp = false
    failErrMsg = 'request:fail url not in domain list'
    const res = await auth.login()
    assert.strictEqual(res.ok, false)
    assert.strictEqual(res.error, 'NETWORK')
    assert.ok(res.message.indexOf('合法域名') > -1, '应提示合法域名问题：' + res.message)
    failErrMsg = 'request:fail'
  })

  await check('探活：第一个地址不通时自动改用第二个', async () => {
    auth.resetBackendStatus()
    // 只有局域网地址有响应（模拟真机预览：127.0.0.1 连的是手机自己）
    upHosts = new Set(['192.168.1.100:8080'])
    const status = await auth.probeBackend()
    assert.strictEqual(status.ok, true)
    assert.strictEqual(status.base, 'http://192.168.1.100:8080')
    assert.strictEqual(auth.activeBase(), 'http://192.168.1.100:8080')
  })

  await check('探活成功后记住这个地址，下次直接用', async () => {
    const res = await auth.login()
    assert.strictEqual(res.ok, true)
    assert.ok(lastRequest.url.indexOf('192.168.1.100:8080') > -1, lastRequest.url)
  })

  await check('探活：一个都连不上时报错里要列出试过的地址', async () => {
    auth.resetBackendStatus()
    upHosts = new Set()
    const status = await auth.probeBackend()
    assert.strictEqual(status.ok, false)
    assert.ok(status.message.indexOf('127.0.0.1:8080') > -1, '应列出试过的地址：' + status.message)
    assert.ok(status.message.indexOf('192.168.1.100:8080') > -1, '应列出试过的地址：' + status.message)
    upHosts = null
  })

  console.log('\ntoken 过期与静默续登')

  await check('token 过期会自动续登并重试，用户不用重新点登录', async () => {
    backendUp = true
    await auth.login()
    const before = auth.getState().token
    expireAuthed = true
    const res = await auth.mergeLocalToAccount()
    assert.strictEqual(res.ok, true, JSON.stringify(res))
    assert.notStrictEqual(auth.getState().token, before, '应该换成了新 token')
    assert.strictEqual(auth.isLoggedIn(), true, '用户仍然是登录态')
  })

  await check('账号被注销时不靠续登复活它，直接退回游客模式', async () => {
    await auth.login()
    deleteAccount = true
    const res = await auth.mergeLocalToAccount()
    assert.strictEqual(res.ok, false)
    assert.strictEqual(auth.isLoggedIn(), false, '账号已注销，应回到游客模式')
    assert.strictEqual(db.aliveCheckIns().length, 2, '本机记录一条不少')
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

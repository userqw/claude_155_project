/**
 * 账号与登录（PRD §5.6，游客优先）。
 *
 * 三条硬规则，改动本文件前请先确认没有破坏它们：
 *   1. 浏览永不被强制登录——本模块不做任何页面拦截，只提供状态查询。
 *   2. 游客模式下全部本地功能可用，写操作也不要求登录。
 *   3. 退出登录不删除本地数据；只有「注销账号」才清空。
 */

const db = require('./db')
const CONFIG = require('./config')

const STORAGE_KEY = 'nt_account_v1'

const ERROR = {
  NOT_CONFIGURED: '登录服务未配置',
  NETWORK: '网络连接失败',
  SERVER: '登录服务异常',
  DELETED: '该账号已注销'
}

/**
 * 把微信的 errMsg 翻译成人能看懂的话。
 *
 * 之前这里一律返回「网络连接失败」，把 wx.request 给的真话全吞了——
 * 最常见的两条（不在合法域名列表、真机连不上电脑的 127.0.0.1）
 * 长得完全不一样，猜不出来，只能靠日志猜。
 */
function describeNetworkError(errMsg) {
  const raw = (errMsg || '').toString()
  if (!raw) return ERROR.NETWORK
  if (/not in domain list|不在.*合法域名|url not in domain/i.test(raw)) {
    return '请求地址不在小程序合法域名列表里（开发者工具：详情 → 本地设置 → 勾选「不校验合法域名…」）'
  }
  if (/timeout/i.test(raw)) {
    return '连接后端超时，后端没起来或地址不对'
  }
  if (/ECONNREFUSED|connect.*refused|无法连接/i.test(raw)) {
    return '连不上后端。真机预览时 127.0.0.1 指的是手机自己，要用电脑的局域网 IP'
  }
  if (/ssl|certificate|https/i.test(raw)) {
    return 'HTTPS 证书或 TLS 版本不通过（开发者工具可勾「不校验合法域名…」绕过）'
  }
  return ERROR.NETWORK + '（' + raw + '）'
}

let state = null
let listeners = []

function defaultState() {
  return {
    mode: 'guest', // 'guest' | 'account'
    account: null, // { openid, nickname, avatarUrl, createdAt }
    token: '',
    // 后端是否在 mock 模式（没配小程序 appid/secret，openid 是假的）
    mock: false,
    deviceId: '',
    // 用户是否已主动选择「先随便看看」
    skippedLogin: false,
    // 首次引导条是否已被关闭
    promptDismissed: false,
    // 登录那一刻的本机记录数，用于合并结果提示
    localRecordsAtLogin: 0
  }
}

function init() {
  if (state) return state
  let saved = null
  try {
    saved = wx.getStorageSync(STORAGE_KEY)
  } catch (e) {
    saved = null
  }
  state = Object.assign(defaultState(), saved || {})
  if (!state.deviceId) {
    state.deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    persist()
  }
  // 账号态必须同时有 token 与 account，否则退回游客
  if (state.mode === 'account' && (!state.token || !state.account)) {
    state.mode = 'guest'
    state.account = null
    state.token = ''
  }
  return state
}

function persist() {
  try {
    wx.setStorageSync(STORAGE_KEY, state)
  } catch (e) {
    console.error('[auth] 写入账号状态失败', e)
  }
  emit()
}

function emit() {
  listeners.slice().forEach((fn) => {
    try {
      fn(state)
    } catch (e) {
      console.error('[auth] listener error', e)
    }
  })
}

function subscribe(fn) {
  listeners.push(fn)
  return function unsubscribe() {
    const i = listeners.indexOf(fn)
    if (i > -1) listeners.splice(i, 1)
  }
}

function getState() {
  if (!state) init()
  return state
}

function isLoggedIn() {
  return getState().mode === 'account'
}

function isGuest() {
  return !isLoggedIn()
}

/** 是否该展示首次登录引导条：未登录、没跳过、也没手动关过 */
function shouldShowPrompt() {
  const s = getState()
  return s.mode !== 'account' && !s.skippedLogin && !s.promptDismissed
}

function dismissPrompt() {
  getState().promptDismissed = true
  persist()
}

/** 用户点「先随便看看」——进入游客模式，之后不再打扰 */
function skipLogin() {
  const s = getState()
  s.mode = 'guest'
  s.skippedLogin = true
  s.promptDismissed = true
  persist()
}

// -- 后端调用 ---------------------------------------------------------------

function backendReady() {
  return !!(CONFIG.apiBase || CONFIG.cloudFunction)
}

// -- 后端地址探活 -------------------------------------------------------------

const BASE_CACHE_KEY = 'nt_api_base_v1'
// 探活结果：{ ok, base, message }。base 为空表示没连上任何一个地址。
let baseStatus = { ok: false, base: '', message: '' }
// 上次探活成功的地址。只存在这里和 storage 里，
// **不要回写 CONFIG.apiBase** —— 那会把候选地址列表塌缩成一个，
// 下次探活就再也试不到别的地址了。
let resolvedBase = ''

/** 当前实际使用的后端地址：优先用上次探活成功的那个 */
function activeBase() {
  if (resolvedBase) return resolvedBase
  try {
    const cached = wx.getStorageSync(BASE_CACHE_KEY)
    if (cached) {
      resolvedBase = cached
      return cached
    }
  } catch (e) {
    // 读不到就用配置里的
  }
  return CONFIG.apiBase
}

/** 把探活成功的地址记下来，下次直接用，省掉一次探测 */
function rememberBase(base) {
  baseStatus = { ok: true, base: base, message: '' }
  resolvedBase = base
  try {
    wx.setStorageSync(BASE_CACHE_KEY, base)
  } catch (e) {
    // 存不住也不影响用
  }
}

/**
 * 挨个探活候选地址，返回第一个能通的。
 *
 * 为什么需要：模拟器能用 127.0.0.1，真机不行（手机上 127.0.0.1 是手机自己）。
 * 与其让用户自己猜该填哪个地址，不如挨个试——哪个通用哪个。
 */
function probeBackend() {
  if (CONFIG.cloudFunction) {
    return Promise.resolve({ ok: true, base: 'cloud:' + CONFIG.cloudFunction, message: '' })
  }
  const candidates = []
  const push = (b) => {
    if (b && candidates.indexOf(b) === -1) candidates.push(b)
  }
  push(activeBase())
  push(CONFIG.apiBase)
  ;(CONFIG.apiCandidates || []).forEach(push)

  if (!candidates.length) {
    baseStatus = { ok: false, base: '', message: ERROR.NOT_CONFIGURED }
    return Promise.resolve(baseStatus)
  }

  const tryOne = (base) =>
    new Promise((resolve) => {
      wx.request({
        url: base + CONFIG.healthPath,
        method: 'GET',
        timeout: 4000,
        success: (res) => {
          const body = res.data || {}
          resolve(res.statusCode >= 200 && res.statusCode < 300 && body.code === 0 ? base : null)
        },
        fail: () => resolve(null)
      })
    })

  const walk = (i) => {
    if (i >= candidates.length) {
      baseStatus = {
        ok: false,
        base: '',
        message: '连不上后端（试过：' + candidates.join('、') + '）。后端起了吗？真机预览要用电脑的局域网 IP。'
      }
      return Promise.resolve(baseStatus)
    }
    return tryOne(candidates[i]).then((hit) => {
      if (hit) {
        rememberBase(hit)
        return baseStatus
      }
      return walk(i + 1)
    })
  }
  return walk(0)
}

/** 后端连通状态（供页面展示诊断信息） */
function backendStatus() {
  return baseStatus
}

/** 强制下次请求重新探活 */
function resetBackendStatus() {
  baseStatus = { ok: false, base: '', message: '' }
  resolvedBase = ''
  try {
    wx.removeStorageSync(BASE_CACHE_KEY)
  } catch (e) {
    // 忽略
  }
}

function request(path, data, method, opts) {
  if (!backendReady()) {
    return Promise.reject({ code: 'NOT_CONFIGURED', message: ERROR.NOT_CONFIGURED })
  }
  const verb = method || 'POST'
  const options = opts || {}
  if (CONFIG.cloudFunction) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: CONFIG.cloudFunction,
        data: Object.assign({ path: path }, data),
        success: (res) => {
          const body = res.result || {}
          if (body.code && body.code !== 0) {
            reject({ code: 'SERVER', message: body.message || ERROR.SERVER })
            return
          }
          resolve(body.data || body)
        },
        fail: (err) => reject({ code: 'NETWORK', message: describeNetworkError(err && err.errMsg) })
      })
    })
  }
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' }
    // 后端从 Authorization 头取 token（不放 body），登录接口本身不需要
    if (path !== CONFIG.paths.login) {
      const t = getState().token
      if (t) {
        header.Authorization = 'Bearer ' + t
      }
    }
    wx.request({
      url: activeBase() + path,
      method: verb,
      header: header,
      data: data,
      timeout: 10000,
      success: (res) => {
        const body = res.data || {}
        // 后端统一返回 HTTP 200 + {code, message, data}，业务错误靠 code 区分。
        // 只看 statusCode 会把失败当成功——登录失败会表现成「拿到一个没有 token 的对象」。
        if (body.code !== undefined && body.code !== 0) {
          // token 过期：静默续登一次再重试，用户不该被弹回登录页
          if (body.code === 401 && !options.noRetry && path !== CONFIG.paths.login) {
            if (isAccountGone(body.message)) {
              // 账号被注销了，不能靠续登把它「复活」——回退到游客模式
              logout()
              reject({ code: 401, message: body.message || '账号已注销' })
              return
            }
            refreshToken().then((ok) => {
              if (ok) {
                resolve(request(path, data, verb, { noRetry: true }))
              } else {
                reject({ code: 401, message: body.message || '登录已过期，请重新登录' })
              }
            }).catch(reject)
            return
          }
          reject({ code: body.code, message: body.message || ERROR.SERVER })
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && !body.error) {
          resolve(body.data || body)
          return
        }
        reject({ code: 'SERVER', message: body.message || ERROR.SERVER })
      },
      fail: (err) => reject({ code: 'NETWORK', message: describeNetworkError(err && err.errMsg) })
    })
  })
}

/** 后端说「账号不存在或已注销」——这种不能靠续登复活 */
function isAccountGone(message) {
  return typeof message === 'string' && message.indexOf('注销') > -1
}

// -- 静默续登 ----------------------------------------------------------------

// 正在进行的续登。并发请求只触发一次换 token，其余等它。
let refreshing = null

/**
 * 静默续登：拿一个新的 wx.login code 换 token。
 *
 * <p>token 有效期 30 天，到期后不该把用户弹回登录页——
 * `wx.login` 不需要用户授权，静默换一个新的就行。
 */
function refreshToken() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const code = await wxLoginCode()
      const res = await request(CONFIG.paths.login, { code: code }, 'POST', { noRetry: true })
      if (!res || !res.token) return false
      const s = getState()
      s.token = res.token
      if (res.account) s.account = res.account
      if (typeof res.mock === 'boolean') s.mock = res.mock
      persist()
      return true
    } catch (e) {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// -- 登录 -------------------------------------------------------------------

/** 取 wx.login 的 code */
function wxLoginCode() {
  return new Promise((resolve, reject) => {
    if (typeof wx.login !== 'function') {
      reject({ code: 'SERVER', message: ERROR.SERVER })
      return
    }
    wx.login({
      success: (res) => {
        if (res.code) resolve(res.code)
        else reject({ code: 'SERVER', message: ERROR.SERVER })
      },
      fail: () => reject({ code: 'NETWORK', message: ERROR.NETWORK })
    })
  })
}

/**
 * 微信一键登录。注册是隐式的：服务端第一次见到 openid 就创建账号。
 *
 * @param {object} [profile] { nickname, avatarUrl }
 *   昵称头像随登录一起发过去，不要等登录完再补一次 updateProfile——
 *   补的那次是第二次请求，失败就只剩一个没有昵称的空账号。
 *   注意：微信的 code2session **不返回昵称**，昵称只能由用户在小程序的
 *   `<input type="nickname">` 里自己点一下授权。
 * @returns {Promise<{ok:boolean, account?:object, error?:string, message?:string}>}
 */
async function login(profile) {
  let code
  try {
    code = await wxLoginCode()
  } catch (e) {
    return { ok: false, error: e.code || 'NETWORK', message: e.message || ERROR.NETWORK }
  }

  let res
  try {
    res = await request(CONFIG.paths.login, {
      code: code,
      nickname: (profile && profile.nickname) || '',
      avatarUrl: (profile && profile.avatarUrl) || ''
    })
  } catch (e) {
    return { ok: false, error: e.code || 'SERVER', message: e.message || ERROR.SERVER }
  }

  if (!res || !res.token || !res.account) {
    return { ok: false, error: 'SERVER', message: ERROR.SERVER }
  }

  const s = getState()
  s.mode = 'account'
  s.token = res.token
  s.account = res.account
  // 后端在没配 appid/secret 时跑 mock，openid 是假的。
  // 记下来，界面上要告诉用户「你的真实微信号并没有连上」。
  s.mock = !!res.mock
  s.skippedLogin = true
  s.promptDismissed = true
  s.localRecordsAtLogin = db.aliveCheckIns().length
  persist()
  return { ok: true, account: res.account, mock: s.mock }
}

/** 更新昵称与头像（均为用户主动提供，可为空） */
async function updateProfile(profile) {
  if (!isLoggedIn()) return { ok: false, error: 'GUEST', message: '尚未登录' }
  const patch = {
    nickname: profile.nickname || '',
    avatarUrl: profile.avatarUrl || ''
  }
  try {
    const res = await request(CONFIG.paths.profile, {
      nickname: patch.nickname,
      avatarUrl: patch.avatarUrl
    })
    if (res && res.account) {
      getState().account = res.account
      // 后端顺手报了一下自己是不是还在 mock 模式
      if (typeof res.mock === 'boolean') getState().mock = res.mock
    } else {
      getState().account = Object.assign({}, getState().account, patch)
    }
    persist()
    return { ok: true, account: getState().account, mock: getState().mock }
  } catch (e) {
    // 后端未配置时，本地先记下，服务端接入后再同步
    if (e.code === 'NOT_CONFIGURED') {
      getState().account = Object.assign({}, getState().account, patch)
      persist()
      return { ok: true, localOnly: true, account: getState().account }
    }
    return { ok: false, error: e.code || 'SERVER', message: e.message || ERROR.SERVER }
  }
}

/**
 * 从后端拉一次账号资料。
 *
 * 用途不是「拿昵称」——昵称在登录时就已经存上去了——而是同步**后端的模式**：
 * 后端可能在你登录之后才配好 appid/secret，这时 openid 才变成真的。
 * 只看登录那次的 mock 标记会一直停留在旧状态。
 */
async function fetchProfile() {
  if (!isLoggedIn()) return { ok: false, error: 'GUEST', message: '尚未登录' }
  try {
    const res = await request(CONFIG.paths.profile, null, 'GET')
    const s = getState()
    if (res && res.account) s.account = res.account
    if (typeof res.mock === 'boolean') s.mock = res.mock
    persist()
    return { ok: true, account: s.account, mock: s.mock }
  } catch (e) {
    if (e.code === 'NOT_CONFIGURED') return { ok: true, localOnly: true }
    return { ok: false, error: e.code || 'SERVER', message: e.message || ERROR.SERVER }
  }
}

/**
 * 本地时间戳转 ISO 字符串。
 *
 * 本地存储用的是 Date.now()（毫秒数），而后端 DTO 是 LocalDateTime——
 * Jackson 不接受裸数字（会报 "raw timestamp not allowed"），
 * 所以上传前统一转成 ISO-8601（UTC）。
 */
function iso(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return new Date(value).toISOString()
  return value
}

function toWire(list, fields) {
  return (list || []).map((row) => {
    const copy = Object.assign({}, row)
    fields.forEach((f) => {
      if (f in copy) copy[f] = iso(copy[f])
    })
    return copy
  })
}

/**
 * 把本机数据合并到账号：上传本地记录与售出，按记录 id 幂等去重。
 * 后端未配置时返回 {ok:true, skipped:true}，本地数据原样保留，不算失败。
 */
async function mergeLocalToAccount() {
  if (!isLoggedIn()) return { ok: false, error: 'GUEST', message: '尚未登录' }
  const all = db.exportAll()
  const count = all.checkIns.length
  if (!count && !all.sales.length) {
    return { ok: true, merged: 0, skipped: true }
  }
  try {
    // 后端 SyncPushRequest 的字段：deviceId / checkIns / sales / photos / folders / materials。
    // 照片、文件夹、素材在本地是独立集合，这里平铺上传；token 由 Authorization 头带，不放 body。
    await request(CONFIG.paths.push, {
      deviceId: getState().deviceId,
      checkIns: toWire(all.checkIns, ['createdAt', 'updatedAt', 'deletedAt']),
      sales: toWire(all.sales, ['createdAt', 'updatedAt', 'deletedAt']),
      photos: toWire(all.photos, ['createdAt', 'updatedAt', 'deletedAt']),
      folders: toWire(all.folders, ['createdAt', 'updatedAt', 'deletedAt']),
      materials: toWire(all.materials, ['createdAt', 'updatedAt', 'deletedAt'])
    })
    return { ok: true, merged: count }
  } catch (e) {
    // 没有后端就不上传，本地数据一条不少
    if (e.code === 'NOT_CONFIGURED') {
      return { ok: true, merged: count, skipped: true }
    }
    return { ok: false, error: e.code || 'SERVER', message: e.message || ERROR.SERVER }
  }
}

/** 退出登录：回到游客模式，本地数据一律保留 */
function logout() {
  const s = getState()
  s.mode = 'guest'
  s.account = null
  s.token = ''
  s.localRecordsAtLogin = 0
  // 不动 skippedLogin：退出登录后不该再被引导条追着跑
  persist()
  return { ok: true }
}

/** 注销账号：服务端删除该 openid 的全部数据，本机数据一并清空 */
async function deleteAccount() {
  if (!isLoggedIn()) return { ok: false, error: 'GUEST', message: '尚未登录' }
  const s = getState()
  try {
    await request(CONFIG.paths.delete, {})
  } catch (e) {
    if (e.code === 'DELETED') {
      // 服务端已经没有这个账号了，继续清本地
    } else if (e.code === 'NOT_CONFIGURED') {
      // 后端没配就不调了
    } else {
      return { ok: false, error: e.code || 'SERVER', message: e.message || ERROR.SERVER }
    }
  }
  db.clearAll()
  s.mode = 'guest'
  s.account = null
  s.token = ''
  s.localRecordsAtLogin = 0
  s.skippedLogin = false
  s.promptDismissed = false
  persist()
  return { ok: true }
}

/**
 * 开发者模式：在没有后端的环境下预览已登录界面。
 * 仅供本地开发调试，界面上有明确标识，线上版本不暴露。
 */
function devLogin() {
  const s = getState()
  s.mode = 'account'
  s.token = 'dev_token_' + Date.now().toString(36)
  s.account = {
    openid: 'dev_openid',
    nickname: '开发者模式',
    avatarUrl: '',
    createdAt: Date.now()
  }
  s.skippedLogin = true
  s.promptDismissed = true
  s.localRecordsAtLogin = db.aliveCheckIns().length
  persist()
  return { ok: true, account: s.account }
}

module.exports = {
  ERROR,
  init,
  getState,
  subscribe,
  isLoggedIn,
  isGuest,
  shouldShowPrompt,
  dismissPrompt,
  skipLogin,
  login,
  updateProfile,
  fetchProfile,
  mergeLocalToAccount,
  logout,
  deleteAccount,
  devLogin,
  backendReady,
  backendStatus,
  probeBackend,
  resetBackendStatus,
  activeBase,
  refreshToken
}

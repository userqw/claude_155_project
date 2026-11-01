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

let state = null
let listeners = []

function defaultState() {
  return {
    mode: 'guest', // 'guest' | 'account'
    account: null, // { openid, nickname, avatarUrl, createdAt }
    token: '',
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

function request(path, data) {
  if (!backendReady()) {
    return Promise.reject({ code: 'NOT_CONFIGURED', message: ERROR.NOT_CONFIGURED })
  }
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
        fail: () => reject({ code: 'NETWORK', message: ERROR.NETWORK })
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
      url: CONFIG.apiBase + path,
      method: 'POST',
      header: header,
      data: data,
      timeout: 10000,
      success: (res) => {
        const body = res.data || {}
        // 后端统一返回 HTTP 200 + {code, message, data}，业务错误靠 code 区分。
        // 只看 statusCode 会把失败当成功——登录失败会表现成「拿到一个没有 token 的对象」。
        if (body.code !== undefined && body.code !== 0) {
          reject({ code: body.code, message: body.message || ERROR.SERVER })
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && !body.error) {
          resolve(body.data || body)
          return
        }
        reject({ code: 'SERVER', message: body.message || ERROR.SERVER })
      },
      fail: () => reject({ code: 'NETWORK', message: ERROR.NETWORK })
    })
  })
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
 * @returns {Promise<{ok:boolean, account?:object, error?:string, message?:string}>}
 */
async function login() {
  let code
  try {
    code = await wxLoginCode()
  } catch (e) {
    return { ok: false, error: e.code || 'NETWORK', message: e.message || ERROR.NETWORK }
  }

  let res
  try {
    res = await request(CONFIG.paths.login, { code: code })
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
  s.skippedLogin = true
  s.promptDismissed = true
  s.localRecordsAtLogin = db.aliveCheckIns().length
  persist()
  return { ok: true, account: res.account }
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
    } else {
      getState().account = Object.assign({}, getState().account, patch)
    }
    persist()
    return { ok: true, account: getState().account }
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
  mergeLocalToAccount,
  logout,
  deleteAccount,
  devLogin,
  backendReady
}

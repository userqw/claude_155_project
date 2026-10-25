/**
 * 后端配置。
 *
 * 账号体系（PRD §5.6）需要一套自己的服务端。客户端只依赖这几个接口契约，
 * 后端是自有服务器、云开发云函数还是 BaaS 都不影响客户端代码。
 *
 * 三种模式：
 *   1. apiBase 有值   → wx.request 直连 HTTP 接口
 *   2. cloudFunction  有值 → wx.cloud.callFunction
 *   3. 都没配          → 登录服务不可用，客户端降级为「仅本地 + 游客模式」
 */

const CONFIG = {
  // 例：'https://api.example.com'
  apiBase: '',
  // 云开发云函数名（与 apiBase 二选一）
  cloudFunction: '',
  // 登录相关接口路径
  paths: {
    login: '/api/login',
    profile: '/api/profile',
    push: '/api/sync/push',
    pull: '/api/sync/pull',
    delete: '/api/account/delete'
  }
}

module.exports = CONFIG

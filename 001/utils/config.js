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
  // 后端地址。本地联调指向 005.后端代码 跑起来的服务：
  //   微信开发者工具 -> 详情 -> 本地设置 -> 勾选「不校验合法域名…」
  // 真机预览要换成电脑的局域网 IP（手机连同一个 Wi-Fi），例如 http://192.168.1.10:8080
  apiBase: 'http://127.0.0.1:8080',
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

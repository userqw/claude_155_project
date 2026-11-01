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
  // 后端地址。**模拟器**用 127.0.0.1；**真机预览必须换电脑的局域网 IP**
  // （手机上 127.0.0.1 指的是手机自己，连不上你的电脑）。
  //   微信开发者工具 -> 详情 -> 本地设置 -> 勾选「不校验合法域名…」
  apiBase: 'http://127.0.0.1:8080',
  // 备用地址。登录前会挨个探活（GET /api/health），谁先通用谁，结果记住。
  // 192.168.1.100 是这台电脑的 WLAN 地址——真机预览时靠它连上后端。
  // 换网络后要改这里（cmd 里跑 ipconfig 看 IPv4）。
  apiCandidates: [
    'http://192.168.1.100:8080'
  ],
  // 云开发云函数名（与 apiBase 二选一）
  cloudFunction: '',
  // 探活接口（免鉴权），用来判断「后端到底通不通」
  healthPath: '/api/health',
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

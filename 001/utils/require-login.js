const auth = require('./auth')

/**
 * 「登录后才能用」的守卫。
 *
 * <p>打卡是写操作，要登录才能做（PRD §5.6）。未登录时不打断，
 * 直接把人带到登录页；登录页上有「先随便看看」，随时能走。
 *
 * <p>页面跳转放在这里而不是 `utils/auth.js`：账号状态机刻意不含任何
 * `navigateTo` / `showModal`（CLAUDE.md 规则 8），
 * 「状态」与「跳转」要分开，否则账号模块就长出了副作用。
 *
 * @param {object} [options]
 * @param {string} [options.redirect] 登录成功后接着去的页面（如 '/pages/checkin/index'）。
 *                                   不传就登录完回原来那一页。
 * @param {string} [options.title]    传给登录页的提示文案
 * @param {boolean} [options.replace] 用 redirectTo 代替 navigateTo 跳登录页——
 *                                   当前页本身就要被登录页顶掉时用（比如打卡页自己拦），
 *                                   否则页面栈会越叠越深
 * @returns {boolean} 已登录返回 true（可以继续），未登录返回 false
 */
function requireLogin(options) {
  const opts = options || {}
  if (auth.isLoggedIn()) return true

  const query = ['intent=login']
  if (opts.redirect) query.push('redirect=' + encodeURIComponent(opts.redirect))
  if (opts.title) query.push('title=' + encodeURIComponent(opts.title))
  const url = '/pages/login/index?' + query.join('&')
  if (opts.replace) {
    wx.redirectTo({ url })
  } else {
    wx.navigateTo({ url })
  }
  return false
}

/**
 * 安全地退回上一个页面。
 *
 * <p>打卡页可能被直接打开（没有上一页），`navigateBack` 会失败，
 * 失败就回首页——不能把用户留在一个空页面上。
 */
function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
    return
  }
  wx.switchTab({ url: '/pages/index/index' })
}

module.exports = { requireLogin, goBack }

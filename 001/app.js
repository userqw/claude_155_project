const db = require('./utils/db')
const cloud = require('./utils/cloud')
const auth = require('./utils/auth')
const { THEME } = require('./utils/constants')

App({
  globalData: {
    theme: 'light',
    // 数据变更广播：页面 onShow 时订阅，写操作后自动刷新
    dbVersion: 0,
    cloudEnabled: false,
    // 账号态：'guest'（游客/未登录）| 'account'（已登录）
    authMode: 'guest'
  },

  onLaunch() {
    this.initTheme()
    db.init()
    auth.init()
    this.globalData.cloudEnabled = cloud.init()
    this.globalData.authMode = auth.getState().mode
    auth.subscribe((s) => {
      this.globalData.authMode = s.mode
    })
  },

  initTheme() {
    const apply = (theme) => {
      const t = theme === 'dark' ? 'dark' : 'light'
      this.globalData.theme = t
      // 同步导航栏配色（app.json darkmode 的补充，覆盖部分机型的差异）
      wx.setNavigationBarColor({
        frontColor: t === 'dark' ? '#F4ECF7' : '#4A3A52',
        backgroundColor: THEME[t].navigationBarBackgroundColor,
        success: () => {}
      })
      // 下拉与回弹露出的底色，避免暗色模式下底部出现一条白边
      wx.setBackgroundColor({
        backgroundColor: THEME[t].page,
        backgroundColorTop: THEME[t].page,
        backgroundColorBottom: THEME[t].page,
        success: () => {}
      })
      this.broadcastTheme()
    }

    try {
      const info = wx.getSystemInfoSync()
      apply(info.theme)
      if (wx.onThemeChange) {
        wx.onThemeChange((res) => apply(res.theme))
      }
    } catch (e) {
      apply('light')
    }
  },

  broadcastTheme() {
    const pages = getCurrentPages()
    pages.forEach((p) => {
      if (p && typeof p.onAppThemeChange === 'function') {
        p.onAppThemeChange(this.globalData.theme)
      }
    })
  },

  onError(err) {
    console.error('[捏土打卡] 未捕获异常', err)
  }
})

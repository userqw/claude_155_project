const app = getApp()
const auth = require('../../../utils/auth')
const db = require('../../../utils/db')

Page({
  data: {
    theme: 'light',
    loggedIn: false,
    account: null,
    localCount: 0,
    statusText: '',
    devVisible: false
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme })
    this._unsub = auth.subscribe(() => this.load())
    this.load()
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    this.load()
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
    this.load()
  },

  load() {
    const loggedIn = auth.isLoggedIn()
    const account = auth.getState().account
    const localCount = db.aliveCheckIns().length
    this.setData({
      loggedIn: loggedIn,
      account: account,
      localCount: localCount,
      devVisible: !auth.backendReady(),
      statusText: loggedIn
        ? '微信账号已绑定 · 数据可备份到云端'
        : '数据只存在这台设备上 · 清理缓存会丢失'
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  async onMerge() {
    wx.showLoading({ title: '备份中…' })
    const res = await auth.mergeLocalToAccount()
    wx.hideLoading()
    if (!res.ok) {
      wx.showToast({ title: res.message || '备份失败', icon: 'none' })
      return
    }
    if (res.skipped) {
      wx.showToast({ title: '本机没有需要备份的记录', icon: 'none' })
      return
    }
    wx.showToast({ title: '已备份 ' + res.merged + ' 条记录', icon: 'none' })
  },

  onSetAvatar() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录？',
      content: '退出后回到游客模式，本机的记录和照片一条都不会少。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return
        auth.logout()
        wx.showToast({ title: '已退出登录', icon: 'none' })
        this.load()
      }
    })
  },

  onClearLocal() {
    wx.showModal({
      title: '清除本机数据？',
      content: '这台设备上的记录、照片和售出信息会被永久删除，无法恢复。云端数据不受影响。',
      confirmColor: '#D03B3B',
      confirmText: '清除',
      success: (res) => {
        if (!res.confirm) return
        db.clearAll()
        wx.showToast({ title: '本机数据已清除', icon: 'none' })
        this.load()
      }
    })
  },

  onDeleteAccount() {
    wx.showModal({
      title: '注销账号？',
      content: '云端和本机的全部数据都会被永久删除，无法恢复。这一步不可撤销。',
      confirmColor: '#D03B3B',
      confirmText: '永久注销',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '再确认一次',
          content: '注销后无法找回任何记录，确定要注销吗？',
          confirmColor: '#D03B3B',
          confirmText: '确定注销',
          success: async (r2) => {
            if (!r2.confirm) return
            const res2 = await auth.deleteAccount()
            if (!res2.ok) {
              wx.showToast({ title: res2.message || '注销失败', icon: 'none' })
              return
            }
            wx.showToast({ title: '账号已注销', icon: 'none' })
            this.load()
          }
        })
      }
    })
  },

  onDevLogin() {
    auth.devLogin()
    wx.showToast({ title: '开发者模式已登录', icon: 'none' })
    this.load()
  }
})

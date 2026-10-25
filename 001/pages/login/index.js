const app = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    theme: 'light',
    nickname: '',
    avatarUrl: '',
    agreed: false,
    loading: false,
    errorMessage: '',
    devVisible: false,
    alreadyLoggedIn: false
  },

  onLoad() {
    const backendReady = auth.backendReady()
    const account = auth.getState().account
    this.setData({
      theme: app.globalData.theme,
      nickname: account ? account.nickname || '' : '',
      avatarUrl: account ? account.avatarUrl || '' : '',
      alreadyLoggedIn: auth.isLoggedIn(),
      // 后端没配时提示一句，并开放开发者模式预览已登录界面
      devVisible: !backendReady,
      errorMessage: backendReady ? '' : '登录服务还未配置，现在只能以游客身份使用；不影响记录和统计。'
    })
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
  },

  onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl
    if (!url) return
    this.setData({ avatarUrl: url })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  onShowPolicy(e) {
    const type = e.currentTarget.dataset.type
    const isPrivacy = type === 'privacy'
    wx.showModal({
      title: isPrivacy ? '隐私政策要点' : '用户协议要点',
      content: isPrivacy
        ? '· 本应用不收集手机号，不做实名\n' +
          '· 昵称与头像只在你主动填写/选择后保存\n' +
          '· 不登录时数据仅存在你的设备上\n' +
          '· 你可以随时在「我的 → 账号设置」注销并删除全部数据'
        : '· 本应用提供粘土手作的记录与统计功能\n' +
          '· 你的作品与记录归你所有，登录后也只是为了备份\n' +
          '· 游客模式下同样可以完整使用\n' +
          '· 使用即表示你理解并接受这些条款',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /** 跳过：进入游客模式，回到来源页。本地功能完全不受影响 */
  onSkip() {
    if (this.data.alreadyLoggedIn) {
      this.back()
      return
    }
    auth.skipLogin()
    wx.showToast({ title: '先用游客模式，数据存在本机', icon: 'none' })
    this.back()
  },

  async onLogin() {
    if (this.data.loading) return

    // 已登录时进来是改资料，不需要重复登录，也不必再同意协议
    if (this.data.alreadyLoggedIn) {
      this.setData({ loading: true, errorMessage: '' })
      const res = await auth.updateProfile({
        nickname: this.data.nickname,
        avatarUrl: this.data.avatarUrl
      })
      this.setData({ loading: false })
      if (!res.ok) {
        this.setData({ errorMessage: res.message || '保存失败' })
        return
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => this.back(), 600)
      return
    }

    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' })
      return
    }
    this.setData({ loading: true, errorMessage: '' })

    const res = await auth.login()
    if (!res.ok) {
      this.setData({ loading: false, errorMessage: (res.message || '登录失败') + '，你仍然可以先随便看看。' })
      return
    }

    // 登录成功后把本机数据合并到账号（默认行为，见 PRD §5.6.6）
    const merge = await auth.mergeLocalToAccount()
    this.setData({ loading: false })

    if (merge.ok && merge.merged > 0) {
      wx.showToast({ title: '已合并 ' + merge.merged + ' 条记录', icon: 'none' })
    } else if (merge.ok) {
      wx.showToast({ title: '登录成功', icon: 'success' })
    } else {
      wx.showToast({ title: '登录成功，但数据同步失败', icon: 'none' })
    }

    // 昵称与头像为可选补充
    if (this.data.nickname || this.data.avatarUrl) {
      auth.updateProfile({ nickname: this.data.nickname, avatarUrl: this.data.avatarUrl })
    }

    setTimeout(() => this.back(), 800)
  },

  onDevLogin() {
    auth.devLogin()
    wx.showToast({ title: '开发者模式已登录', icon: 'none' })
    this.back()
  },

  back() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  }
})

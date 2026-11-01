const app = getApp()
const auth = require('../../utils/auth')
const photos = require('../../utils/photos')

/**
 * 主按钮的文案。
 *
 * <p>之前不管从哪儿进来，只要本地还是登录态就显示「保存资料」——
 * 从「我的 → 微信一键登录」点进来也会看到它，于是点下去只是把资料
 * 又存了一遍，看着就像「登录没反应，账号反倒没了」。
 *
 * @param {string} intent      'login' 表示明确是来登录的
 * @param {boolean} loggedIn   本地是否已是登录态
 */
function labelFor(intent, loggedIn) {
  if (intent === 'login') return '登录'
  if (loggedIn) return '保存资料'
  return '微信一键登录'
}

Page({
  data: {
    theme: 'light',
    nickname: '',
    avatarUrl: '',
    agreed: false,
    loading: false,
    errorMessage: '',
    backendNote: '',
    mockNote: '',
    devVisible: false,
    alreadyLoggedIn: false,
    // 'login' = 明确是来登录的（从「我的」的一键登录进来）
    // 空 = 可能是来改资料的（从账号设置进来）
    intent: '',
    actionText: '微信一键登录'
  },

  onLoad(options) {
    const backendReady = auth.backendReady()
    const account = auth.getState().account
    const intent = (options && options.intent) || ''
    const loggedIn = auth.isLoggedIn()
    this.setData({
      theme: app.globalData.theme,
      nickname: account ? account.nickname || '' : '',
      avatarUrl: auth.avatarPath(),
      alreadyLoggedIn: loggedIn,
      intent: intent,
      actionText: labelFor(intent, loggedIn),
      mockNote: this.mockHint(),
      // 后端没配时提示一句，并开放开发者模式预览已登录界面
      devVisible: !backendReady,
      errorMessage: backendReady ? '' : '登录服务还未配置，现在只能以游客身份使用；不影响记录和统计。'
    })
    // 先探活：登录失败时能直接告诉用户是「地址不对」还是「后端没起」，
    // 而不是只丢一句「网络连接失败」。
    // 这里不 await，所以要自己接住异常——onLoad 里抛出去没人管，
    // 只会变成一条看不懂的运行时错误。
    if (backendReady) {
      this.checkBackend().catch((e) => {
        console.error('[登录] 探活失败', e)
        this.setData({ errorMessage: (e && e.message) || '连不上后端' })
      })
    }
  },

  /** 探活并把结果写进页面；连不通就把原因说清楚 */
  async checkBackend() {
    const status = await auth.probeBackend()
    if (status.ok) {
      this.setData({ errorMessage: '', backendNote: '后端已连接：' + status.base })
      return true
    }
    this.setData({
      errorMessage: status.message || '连不上后端，现在只能以游客身份使用；不影响记录和统计。',
      backendNote: ''
    })
    return false
  },

  /**
   * 后端在 mock 模式时要讲清楚：此时登录拿到的是**假的 openid**，
   * 不是用户的真实微信号，数据库里也查不到自己的账号。
   * 同时给出换成真实登录的具体位置，别让人对着这句话发懵。
   */
  mockHint() {
    return auth.getState().mock
      ? '当前是本地联调模式：登录拿到的是模拟账号，不是你的真实微信号。'
          + '要换成真实登录，在 005.后端代码/src/main/resources/application-local.yml 的'
          + ' app.wechat.secret 填入小程序 AppSecret，重启后端即可。'
      : ''
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
  },

  /**
   * 选头像。
   *
   * <p>chooseAvatar 给的是 wxfile://tmp_xxx.jpg——临时文件，重启后就被系统回收。
   * 立刻存成本地持久文件，否则头像看着有、其实留不住。
   *
   * <p>存盘失败也不能影响登录：头像只是可选的，
   * 崩在这里会连带打断整个登录流程（表现为「点了没反应」）。
   */
  async onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl
    if (!url) return
    this.setData({ avatarUrl: url })
    try {
      const saved = await photos.saveToLocal(url)
      if (saved && saved.url) {
        this.setData({ avatarUrl: saved.url })
        auth.setLocalAvatar(saved.url)
      }
    } catch (err) {
      // 存不下就用临时路径，头像这会儿还是能显示的
      console.error('[登录] 保存头像失败', err)
    }
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

    // 明确是来登录的（从「我的 → 微信一键登录」进来）：即使本地已是登录态，
    // 也要真的走一次登录——刷新 token、把昵称头像带上去。
    const wantLogin = this.data.intent === 'login'

    // 没带「来登录」的意图、且本地已登录 → 这是来改资料的
    if (this.data.alreadyLoggedIn && !wantLogin) {
      this.setData({ loading: true, errorMessage: '' })
      try {
        const res = await auth.updateProfile({
          nickname: this.data.nickname,
          avatarUrl: this.data.avatarUrl
        })
        if (!res.ok) {
          this.setData({ errorMessage: res.message || '保存失败' })
          return
        }
        this.setData({ mockNote: this.mockHint() })
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => this.back(), 600)
      } catch (e) {
        this.setData({ errorMessage: (e && e.message) || '保存失败' })
      } finally {
        this.setData({ loading: false })
      }
      return
    }

    // 已经登录过就不用再同意一次协议
    if (!this.data.agreed && !this.data.alreadyLoggedIn) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' })
      return
    }
    this.setData({ loading: true, errorMessage: '' })

    // 整段包在 try 里：任何一个 await 抛出异常都必须把 loading 清掉，
    // 否则界面会永远停在「处理中…」，用户只能杀进程重启。
    try {
      // 登录前先探活：连不上就别让用户对着一个没有意义的失败发呆
      const alive = await this.checkBackend()
      if (!alive) {
        return
      }

      const res = await auth.login({
        nickname: this.data.nickname,
        avatarUrl: this.data.avatarUrl
      })
      if (!res.ok) {
        this.setData({ errorMessage: (res.message || '登录失败') + '，你仍然可以先随便看看。' })
        return
      }

      // 登录成功后把本机数据合并到账号（默认行为，见 PRD §5.6.6）
      const merge = await auth.mergeLocalToAccount()
      this.setData({ mockNote: this.mockHint() })

      if (merge.ok && merge.merged > 0) {
        wx.showToast({ title: '已合并 ' + merge.merged + ' 条记录', icon: 'none' })
      } else if (merge.ok) {
        wx.showToast({ title: '登录成功', icon: 'success' })
      } else {
        wx.showToast({ title: '登录成功，但数据同步失败', icon: 'none' })
      }

      // 昵称与头像已经随登录请求一起发过去了，不用再补一次 updateProfile

      setTimeout(() => this.back(), 800)
    } catch (e) {
      this.setData({
        errorMessage: ((e && e.message) || '登录失败') + '，你仍然可以先随便看看。'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onDevLogin() {
    auth.devLogin()
    wx.showToast({ title: '开发者模式已登录', icon: 'none' })
    this.back()
  },

  back() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      // 返回失败就回首页——登录页不是 tab 页，卡在这儿就看不到底部导航栏
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/index/index' })
      })
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  }
})

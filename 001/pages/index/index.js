const app = getApp()
const db = require('../../utils/db')
const stat = require('../../utils/stat')
const date = require('../../utils/date')
const auth = require('../../utils/auth')
const { requireLogin } = require('../../utils/require-login')

Page({
  data: {
    theme: 'light',
    // 当前是第几个 tab，用于把选中态同步给悬浮 tab bar
    tabIndex: 0,
    year: '',
    today: '',
    todayText: '',
    statusText: '',
    todayRecords: [],
    todayCount: 0,
    hasToday: false,
    overview: null,
    monthTrend: [],
    recent: [],
    showLoginBar: false,
    // 未登录时首页的数字不给看（PRD §5.6.1）
    loggedIn: false
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme })
    this._unsub = db.subscribe(() => this.load())
    this._authUnsub = auth.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
    if (this._authUnsub) this._authUnsub()
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.syncTabBar(this.data.tabIndex)
    this.load()
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
    this.syncTabBar(this.data.tabIndex || 0)
    this.load()
  },

  onPullDownRefresh() {
    this.load()
    wx.stopPullDownRefresh()
  },

  /** 把选中态与主题同步给悬浮 tab bar */
  syncTabBar(selected) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: selected, theme: this.data.theme })
    }
  },

  load() {
    const theme = this.data.theme
    const today = date.today()
    const year = date.yearOf(today)

    // 未登录：累计捏制、已售总额、最近手作记录都不给看（PRD §5.6.1）。
    // 用一份形状相同的空总览，界面不用到处判空；
    // 近 6 个月节奏图也会自动藏起来（它的显示条件是 production > 0）。
    const loggedIn = auth.isLoggedIn()

    const all = loggedIn ? db.listCheckIns() : []
    const todayRecords = all.filter((c) => c.date === today)
    const overview = loggedIn ? stat.yearlyOverview(year, theme) : stat.emptyOverview(year)

    const shapeMap = {}
    db.listShapes().forEach((s) => {
      shapeMap[s.id] = stat.shapeView(s, theme)
    })

    // 近 6 个月迷你趋势
    const now = date.monthOf(today)
    const monthTrend = []
    for (let i = 5; i >= 0; i--) {
      const m = now - i
      const item = m >= 1 ? overview.monthly[m - 1] : { month: m + 12, count: 0 }
      monthTrend.push({
        label: item.month + '月',
        value: item.count,
        color: item.count > 0 ? overview.byShape.length ? overview.byShape[0].color : '#F58BA8' : '#E4D3E0'
      })
    }

    const recent = all.slice(0, 12).map((c) => {
      const photos = db.listPhotos(c.id)
      const sold = db.soldCountByCheckIn()[c.id] || 0
      const unsold = Math.max(0, c.count - sold)
      return {
        id: c.id,
        date: c.date,
        dateText: date.friendly(c.date),
        count: c.count,
        note: c.note,
        cover: photos.length ? photos[0].url : '',
        shape: shapeMap[c.shapeId] || stat.shapeView(null, theme),
        sold: sold,
        unsold: unsold,
        // 状态只有一个：全部卖完才算「售出」，卖了一部分仍是「未售」
        fullySold: c.count > 0 && unsold <= 0
      }
    })

    const streak = loggedIn ? stat.streak() : 0

    this.setData({
      today: today,
      todayText: date.monthOf(today) + '月' + date.dayOf(today) + '日',
      year: year,
      todayRows: todayRecords.map((c) => ({
        id: c.id,
        count: c.count,
        shape: shapeMap[c.shapeId] || stat.shapeView(null, theme)
      })),
      todayRecords: todayRecords,
      todayCount: todayRecords.reduce((s, c) => s + c.count, 0),
      hasToday: todayRecords.length > 0,
      overview: overview,
      monthTrend: monthTrend,
      recent: recent,
      todayRows: todayRecords.map((c) => ({
        id: c.id,
        count: c.count,
        shape: shapeMap[c.shapeId] || stat.shapeView(null, theme)
      })),
      statusText: loggedIn
        ? (streak > 0 ? '连续 ' + streak + ' 天' : '今天还没开工')
        // 未登录时连续天数也是私有数字，不给看
        : '登录后可见',
      // 游客优先：只在用户从未做过选择时提示一次浏览，不拦截任何内容
      showLoginBar: auth.shouldShowPrompt(),
      loggedIn: loggedIn
    })
  },

  // -- 打卡表单 -------------------------------------------------------------

  /** 点「去打卡」跳转到打卡页 */
  onTapCheckin() {
    // 打卡要登录（PRD §5.6）：没登录先带去登录，登录完接着来打卡，
    // 不用再点一次
    if (!requireLogin({ redirect: '/pages/checkin/index' })) return
    wx.navigateTo({ url: '/pages/checkin/index' })
  },

  /** 点今天某一条记录 → 去打卡页编辑 */
  onTapEdit(e) {
    const id = e.currentTarget.dataset.id
    if (!requireLogin({ redirect: '/pages/checkin/index?id=' + id })) return
    wx.navigateTo({ url: '/pages/checkin/index?id=' + id })
  },

  // -- 售出 ---------------------------------------------------------------
  // 记售出的入口在作品详情页（「标记售出」）。首页这一行只显示状态：
  // 之前这里还挂着一个「售出」按钮，未售完的记录会并排显示两个「售出」，
  // 看着像两个状态。现在只留状态徽标。



  // -- 账号 ---------------------------------------------------------------

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onCloseLoginBar() {
    auth.dismissPrompt()
    this.setData({ showLoginBar: false })
  },

  // -- 导航 ---------------------------------------------------------------

  goStats() {
    wx.switchTab({ url: '/pages/stats/year/index' })
  },

  goLibrary() {
    wx.switchTab({ url: '/pages/library/list/index' })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/library/detail/index?id=' + e.currentTarget.dataset.id })
  }
})

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
    showSale: false,
    saleTarget: null,
    saleMax: 1,
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
      return {
        id: c.id,
        date: c.date,
        dateText: date.friendly(c.date),
        count: c.count,
        note: c.note,
        cover: photos.length ? photos[0].url : '',
        shape: shapeMap[c.shapeId] || stat.shapeView(null, theme),
        sold: sold,
        unsold: Math.max(0, c.count - sold)
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

  onTapSell(e) {
    const id = e.currentTarget.dataset.id
    const rec = db.getCheckIn(id)
    if (!rec) return
    // 售出要登录：售出是写操作，售出状态也要跟着账号走
    // （未登录时记录本身就是空的，售出状态自然也不存在）
    if (!requireLogin()) return
    const shape = db.getShape(rec.shapeId)
    const sold = db.soldCountByCheckIn()[id] || 0
    const max = rec.count - sold
    if (max <= 0) {
      wx.showToast({ title: '这条记录的都已售出', icon: 'none' })
      return
    }
    this.setData({
      showSale: true,
      saleTarget: {
        id: id,
        shapeName: shape ? shape.name : '',
        defaultPrice: shape && shape.defaultPrice ? shape.defaultPrice : ''
      },
      saleMax: max
    })
  },

  onSaleClose() {
    this.setData({ showSale: false })
  },

  onSaleSave(e) {
    db.addSale(e.detail)
    this.setData({ showSale: false })
    wx.showToast({ title: '已记录售出', icon: 'success' })
    this.load()
  },

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

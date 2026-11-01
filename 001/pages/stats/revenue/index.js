const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')
const { money } = require('../../../utils/format')
const auth = require('../../../utils/auth')

Page({
  data: {
    theme: 'light',
    years: [],
    year: '',
    overview: null,
    revenueBars: [],
    shapeBars: [],
    channelBars: [],
    sales: [],
    hasData: false,
    // 未登录：营收是私有内容，按空处理
    locked: false
  },

  onLoad(options) {
    this.setData({ theme: app.globalData.theme })
    if (options.year) this.setData({ year: options.year })
    this._unsub = db.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.load()
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
    this.load()
  },

  load() {
    const theme = this.data.theme
    const years = stat.availableYears()
    const current = date.yearOf(date.today())
    const year = this.data.year && years.indexOf(this.data.year) > -1 ? this.data.year : current

    // 未登录：营收是私有内容，按空处理（PRD §5.6.1）
    if (!auth.isLoggedIn()) {
      this.setData({
        locked: true,
        years: [current],
        year: current,
        overview: stat.emptyOverview(year),
        revenueBars: [],
        shapeBars: [],
        channelBars: [],
        sales: [],
        hasData: false
      })
      return
    }

    const overview = stat.yearlyOverview(year, theme)

    const revenueBars = overview.soldMonthly.map((m) => ({
      label: m.month + '月',
      value: m.amount
    }))

    const shapeBars = overview.soldByShape.map((s) => ({
      key: s.shapeId,
      name: s.icon + ' ' + s.name,
      value: s.amount,
      color: s.color
    }))

    const channelBars = overview.byChannel.map((c) => ({
      key: c.channel,
      name: c.name,
      value: c.amount,
      color: theme.accent
    }))

    const shapeMap = {}
    db.listShapes().forEach((s) => {
      shapeMap[s.id] = stat.shapeView(s, theme)
    })

    const sales = db.listSales({ year: year }).map((s) => {
      const ci = db.getCheckIn(s.checkInId)
      const shape = ci ? shapeMap[ci.shapeId] : null
      return {
        id: s.id,
        date: s.soldDate,
        dateText: date.friendly(s.soldDate),
        quantity: s.quantity,
        unitPrice: money(s.unitPrice),
        total: money(s.totalAmount),
        channel: stat.CHANNEL_NAMES[s.channel] || s.channel,
        shape: shape || { name: '未知', icon: '❔' },
        note: s.note
      }
    })

    this.setData({
      locked: false,
      years: years.length ? years : [current],
      year: year,
      overview: overview,
      revenueBars: revenueBars,
      shapeBars: shapeBars,
      channelBars: channelBars,
      sales: sales,
      hasData: sales.length > 0
    })
  },

  onYearChange(e) {
    this.setData({ year: e.currentTarget.dataset.year }, () => this.load())
  }
})

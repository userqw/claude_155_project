const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')
const { money } = require('../../../utils/format')
const auth = require('../../../utils/auth')
const { requireLogin } = require('../../../utils/require-login')

Page({
  data: {
    theme: 'light',
    id: '',
    record: null,
    photos: [],
    sales: [],
    soldCount: 0,
    unsold: 0,
    totalAmount: 0,
    showSale: false,
    saleTarget: null,
    saleMax: 1,
    // 未登录：作品详情是私有内容，按空处理
    locked: false
  },

  onLoad(options) {
    this.setData({ theme: app.globalData.theme, id: options.id || '' })
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
    const id = this.data.id
    // 未登录：作品详情是私有内容，按空处理（PRD §5.6.1）
    if (!auth.isLoggedIn()) {
      this.setData({ locked: true, record: null, photos: [], sales: [] })
      return
    }
    const rec = db.getCheckIn(id)
    if (!rec) {
      this.setData({ record: null })
      return
    }
    const theme = this.data.theme
    const shape = db.getShape(rec.shapeId)
    const photos = db.listPhotos(id)
    const sales = db.listSales({ checkInId: id })
    const soldCount = sales.reduce((s, x) => s + x.quantity, 0)
    const totalAmount = sales.reduce((s, x) => s + x.totalAmount, 0)

    const tagMap = {}
    db.listTags().forEach((t) => {
      tagMap[t.id] = t
    })

    this.setData({
      record: {
        id: rec.id,
        date: rec.date,
        dateText: date.friendly(rec.date),
        count: rec.count,
        note: rec.note,
        durationMin: rec.durationMin,
        shape: stat.shapeView(shape, theme),
        tags: (rec.tagIds || []).map((t) => tagMap[t]).filter(Boolean)
      },
      photos: photos.map((p) => p.url),
      sales: sales.map((s) => ({
        id: s.id,
        dateText: date.friendly(s.soldDate),
        quantity: s.quantity,
        unitPrice: money(s.unitPrice),
        total: money(s.totalAmount),
        channel: stat.CHANNEL_NAMES[s.channel] || s.channel,
        note: s.note
      })),
      soldCount: soldCount,
      unsold: Math.max(0, rec.count - soldCount),
      totalAmount: totalAmount
    })
  },

  onEdit() {
    wx.navigateTo({ url: '/pages/checkin/index?id=' + this.data.id })
  },

  onSell() {
    if (this.data.unsold <= 0) {
      wx.showToast({ title: '这条记录的都已售出', icon: 'none' })
      return
    }
    // 售出要登录：售出是写操作，状态跟着账号走
    if (!requireLogin()) return
    const shape = this.data.record.shape
    this.setData({
      showSale: true,
      saleTarget: { id: this.data.id, shapeName: shape.name, defaultPrice: '' },
      saleMax: this.data.unsold
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

  onRemoveSale(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条售出记录？',
      content: '删除后营收统计会同步回滚。',
      confirmColor: '#D03B3B',
      success: (res) => {
        if (!res.confirm) return
        db.removeSale(id)
        this.load()
      }
    })
  },

  onPreview(e) {
    const current = e.currentTarget.dataset.url
    wx.previewImage({ current: current, urls: this.data.photos })
  }
})

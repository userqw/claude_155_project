const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')

const SORTS = [
  { key: 'time', text: '时间倒序' },
  { key: 'count', text: '数量从多到少' },
  { key: 'amount', text: '金额从高到低' }
]

Page({
  data: {
    theme: 'light',
    // 当前是第几个 tab，用于把选中态同步给悬浮 tab bar
    tabIndex: 2,
    shapes: [],
    shapeFilter: '',
    saleFilter: '',
    keyword: '',
    sortIndex: 0,
    sortText: SORTS[0].text,
    left: [],
    right: [],
    counts: { total: 0, sold: 0, unsold: 0 }
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme })
    this._unsub = db.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
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

  /** 把选中态与主题同步给悬浮 tab bar */
  syncTabBar(selected) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: selected, theme: this.data.theme })
    }
  },

  load() {
    const theme = this.data.theme
    const all = db.listCheckIns()
    const soldMap = db.soldCountByCheckIn()
    const salesByCheckIn = {}
    db.listSales().forEach((s) => {
      salesByCheckIn[s.checkInId] = (salesByCheckIn[s.checkInId] || 0) + (Number(s.totalAmount) || 0)
    })

    // 分类与计数（筛选前统计全量，方便看占比）
    const counts = { total: 0, sold: 0, unsold: 0 }
    const perShape = {}
    all.forEach((c) => {
      counts.total += c.count
      const sold = soldMap[c.id] || 0
      if (sold >= c.count && c.count > 0) counts.sold += c.count
      else counts.unsold += Math.max(0, c.count - sold)
      if (!perShape[c.shapeId]) perShape[c.shapeId] = 0
      perShape[c.shapeId] += c.count
    })

    const shapes = db.listShapes().map((s) => {
      const view = stat.shapeView(s, theme)
      return {
        id: s.id,
        name: view.name,
        icon: view.icon,
        iconPath: view.iconPath,
        color: view.color,
        count: perShape[s.id] || 0
      }
    })

    // 筛选
    let list = all
    if (this.data.shapeFilter) {
      list = list.filter((c) => c.shapeId === this.data.shapeFilter)
    }
    if (this.data.saleFilter) {
      list = list.filter((c) => {
        const sold = soldMap[c.id] || 0
        return this.data.saleFilter === 'sold' ? sold >= c.count && c.count > 0 : sold < c.count
      })
    }
    const kw = (this.data.keyword || '').trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (c) =>
          (c.note || '').toLowerCase().indexOf(kw) > -1 ||
          (c.shapeId && String(c.shapeId).toLowerCase().indexOf(kw) > -1)
      )
    }

    // 排序
    const sortKey = SORTS[this.data.sortIndex].key
    if (sortKey === 'count') {
      list = list.slice().sort((a, b) => b.count - a.count)
    } else if (sortKey === 'amount') {
      list = list.slice().sort((a, b) => (salesByCheckIn[b.id] || 0) - (salesByCheckIn[a.id] || 0))
    }

    const shapeMap = {}
    shapes.forEach((s) => {
      shapeMap[s.id] = s
    })

    const items = list.map((c) => {
      const photos = db.listPhotos(c.id)
      const sold = soldMap[c.id] || 0
      const shape = shapeMap[c.shapeId] || stat.shapeView(null, theme)
      const soldAmount = salesByCheckIn[c.id] || 0
      return {
        id: c.id,
        cover: photos.length ? photos[0].url : '',
        photoCount: photos.length,
        count: c.count,
        note: c.note,
        dateText: date.friendly(c.date),
        shape: shape,
        title: shape.name,
        sold: sold,
        soldAmount: soldAmount,
        fullySold: c.count > 0 && sold >= c.count
      }
    })

    // 两列瀑布流：按照片数估算高度，插到较矮的一列
    const left = []
    const right = []
    let lh = 0
    let rh = 0
    items.forEach((it) => {
      const h = 380 + Math.min(120, it.photoCount * 10)
      if (lh <= rh) {
        left.push(it)
        lh += h
      } else {
        right.push(it)
        rh += h
      }
    })

    this.setData({
      shapes: shapes,
      left: left,
      right: right,
      counts: counts
    })
  },

  // -- 筛选 -----------------------------------------------------------------

  onShapeFilter(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ shapeFilter: this.data.shapeFilter === id ? '' : id }, () => this.load())
  },

  onSaleFilter(e) {
    const v = e.currentTarget.dataset.v
    this.setData({ saleFilter: this.data.saleFilter === v ? '' : v }, () => this.load())
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.load())
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.load())
  },

  onToggleSort() {
    const next = (this.data.sortIndex + 1) % SORTS.length
    this.setData({ sortIndex: next, sortText: SORTS[next].text }, () => this.load())
  },

  // -- 导航 -----------------------------------------------------------------

  goDetail(e) {
    wx.navigateTo({ url: '/pages/library/detail/index?id=' + e.currentTarget.dataset.id })
  },

  onAddWork() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})

const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')
const { THEME } = require('../../../utils/constants')
const { pickTextColor } = require('../../../utils/color')
const auth = require('../../../utils/auth')

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

Page({
  data: {
    theme: 'light',
    year: '',
    years: [],
    months: [],
    weekLabels: WEEK_LABELS,
    heatColors: [],
    emptyColor: '',
    maxCount: 0,
    total: 0,
    activeDays: 0,
    selected: null,
    dayRecords: [],
    // 未登录：日历是私有内容，按空处理
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

    // 未登录：日历热力图是私有内容，按空处理（PRD §5.6.1）
    if (!auth.isLoggedIn()) {
      const months = []
      for (let m = 1; m <= 12; m++) {
        const first = new Date(Number(year), m - 1, 1)
        const offset = (first.getDay() + 6) % 7
        const total = date.daysInMonth(Number(year), m)
        const cells = []
        for (let i = 0; i < offset; i++) cells.push({ key: 'pad' + m + '_' + i, empty: true })
        for (let d = 1; d <= total; d++) {
          const ds = year + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d)
          cells.push({ key: ds, date: ds, day: d, count: 0, level: 0, empty: true })
        }
        months.push({ month: m, cells: cells })
      }
      this.setData({
        locked: true,
        years: [current],
        year: current,
        months: months,
        maxCount: 0,
        total: 0,
        activeDays: 0,
        selected: null,
        dayRecords: [],
        heatColors: THEME[theme].heat,
        emptyColor: THEME[theme].heatEmpty
      })
      return
    }

    const daily = stat.dailyMap(year)
    const counts = Object.keys(daily).map((k) => daily[k])
    const max = counts.length ? Math.max.apply(null, counts) : 0

    const months = []
    for (let m = 1; m <= 12; m++) {
      const first = new Date(Number(year), m - 1, 1)
      // 周一为一周起点
      const offset = (first.getDay() + 6) % 7
      const total = date.daysInMonth(Number(year), m)
      const cells = []
      for (let i = 0; i < offset; i++) {
        cells.push({ key: 'pad' + m + '_' + i, empty: true })
      }
      for (let d = 1; d <= total; d++) {
        const ds = year + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d)
        const count = daily[ds] || 0
        const level = this.level(count, max)
        const color = level ? THEME[theme].heat[level - 1] : THEME[theme].heatEmpty
        cells.push({
          key: ds,
          date: ds,
          day: d,
          count: count,
          level: level,
          color: color,
          // 色块里的日期数字按填充色明度选白字或近黑，避免浅色格上白字看不清
          textColor: pickTextColor(color),
          // 最热的一档标个火苗，和原型一致
          fire: count >= 3,
          selected: ds === this.data.selected,
          future: ds > date.today()
        })
      }
      while (cells.length % 7 !== 0) {
        cells.push({ key: 'pad' + m + '_x' + cells.length, empty: true })
      }
      const weeks = []
      for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7))
      }
      months.push({
        month: m,
        title: m + ' 月',
        weeks: weeks,
        count: itemsTotal(daily, m),
        days: Object.keys(daily).filter((d) => Number(d.slice(5, 7)) === m).length
      })
    }

    this.setData({
      locked: false,
      years: years.length ? years : [current],
      year: year,
      months: months,
      maxCount: max,
      total: counts.reduce((a, b) => a + b, 0),
      activeDays: counts.length,
      heatColors: THEME[theme].heat,
      emptyColor: THEME[theme].heatEmpty
    })
  },

  /** 分 4 档：0 为空心格，其余按最大值分位 */
  level(count, max) {
    if (!count) return 0
    if (max <= 4) return Math.min(4, count)
    const ratio = count / max
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  },

  onTapDay(e) {
    const ds = e.currentTarget.dataset.date
    if (!ds) return
    // 未登录时看不到任何一天的记录
    if (!auth.isLoggedIn()) return
    const records = db.listCheckIns({ date: ds })
    const shapeMap = {}
    db.listShapes().forEach((s) => {
      shapeMap[s.id] = stat.shapeView(s, theme)
    })
    this.setData({
      selected: ds,
      dayRecords: records.map((c) => ({
        id: c.id,
        count: c.count,
        shape: shapeMap[c.shapeId] || stat.shapeView(null, theme)
      }))
    })
    // 重画格子，让选中态的描边生效
    this.load()
  },

  onAddForDay() {
    this.setData({ showCheckin: true, checkinDate: this.data.selected })
  },

  onCheckinClose() {
    this.setData({ showCheckin: false })
  },

  onCheckinSave(e) {
    const detail = e.detail
    if (detail.editing && detail.id) {
      db.updateCheckIn(detail.id, detail.payload)
    } else {
      const rec = db.addCheckIn(detail.payload)
      if (detail.photos && detail.photos.length) {
        db.addPhotos(
          rec.id,
          detail.photos.map((p) => ({ url: p.url, localPath: p.url }))
        )
      }
    }
    this.setData({ showCheckin: false })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.load()
  },

  onYearChange(e) {
    this.setData({ year: e.currentTarget.dataset.year }, () => this.load())
  }
})

function itemsTotal(daily, month) {
  let sum = 0
  Object.keys(daily).forEach((k) => {
    if (Number(k.slice(5, 7)) === month) sum += daily[k]
  })
  return sum
}

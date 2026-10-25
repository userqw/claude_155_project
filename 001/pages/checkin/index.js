const app = getApp()
const db = require('../../utils/db')
const date = require('../../utils/date')
const stat = require('../../utils/stat')
const { MAX_COUNT, MAX_NOTE, MAX_PHOTOS, MIN_DATE, QUICK_COUNTS } = require('../../utils/constants')

/**
 * 打卡页（独立页面，不是弹层）。
 *
 * 三种入口共用这一页，字段与校验完全一致：
 *   /pages/checkin/index              首页新建，固定今天，不显示日期选择
 *   /pages/checkin/index?date=...     日历补录，可改日期
 *   /pages/checkin/index?id=...       作品详情编辑
 */
Page({
  data: {
    theme: 'light',
    editing: false,
    showDate: false,
    shapes: [],
    tags: [],
    quickCounts: QUICK_COUNTS,
    maxNote: MAX_NOTE,
    maxPhotos: MAX_PHOTOS,
    minDate: MIN_DATE,
    maxDate: '',
    saving: false,
    form: {
      date: '',
      shapeId: '',
      count: 1,
      note: '',
      tagIds: [],
      durationMin: '',
      photos: []
    }
  },

  onLoad(options) {
    const theme = app.globalData.theme
    const id = options.id || ''
    const shapes = db.listShapes().map((s) => {
      const view = stat.shapeView(s, theme)
      return {
        id: s.id,
        name: view.name,
        icon: view.icon,
        iconPath: view.iconPath,
        color: view.color
      }
    })

    this.setData({
      theme: theme,
      editing: !!id,
      // 首页新建固定今天，不给改；补录和编辑才让改日期
      showDate: !!(id || options.date),
      shapes: shapes,
      tags: db.listTags(),
      maxDate: date.today()
    })

    if (id) {
      this._recordId = id
      this.loadRecord(id)
    } else {
      this.setData({
        'form.date': options.date || date.today(),
        'form.shapeId': shapes.length ? shapes[0].id : ''
      })
    }
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
  },

  loadRecord(id) {
    const rec = db.getCheckIn(id)
    if (!rec) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.setData({
      form: {
        date: rec.date,
        shapeId: rec.shapeId,
        count: rec.count,
        note: rec.note || '',
        tagIds: (rec.tagIds || []).slice(),
        durationMin: rec.durationMin == null ? '' : String(rec.durationMin),
        photos: db.listPhotos(id).map((p) => ({ id: p.id, url: p.url }))
      }
    })
  },

  // -- 表单 ---------------------------------------------------------------

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onShapeChange(e) {
    this.setData({ 'form.shapeId': e.detail.value })
  },

  onMinus() {
    if (this.data.form.count <= 1) return
    this.setData({ 'form.count': this.data.form.count - 1 })
  },

  onPlus() {
    if (this.data.form.count >= MAX_COUNT) {
      wx.showToast({ title: '一次最多记 ' + MAX_COUNT + ' 个', icon: 'none' })
      return
    }
    this.setData({ 'form.count': this.data.form.count + 1 })
  },

  onQuickCount(e) {
    this.setData({ 'form.count': Number(e.currentTarget.dataset.n) })
  },

  onPhotosChange(e) {
    this.setData({ 'form.photos': e.detail.photos })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onDurationInput(e) {
    this.setData({ 'form.durationMin': e.detail.value })
  },

  onTagToggle(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.form.tagIds.slice()
    const i = list.indexOf(id)
    if (i > -1) list.splice(i, 1)
    else list.push(id)
    this.setData({ 'form.tagIds': list })
  },

  // -- 提交 ---------------------------------------------------------------

  onSave() {
    if (this.data.saving) return
    const form = this.data.form
    if (!form.shapeId) {
      wx.showToast({ title: '先选一个作品类型', icon: 'none' })
      return
    }
    if (!form.count || form.count < 1) {
      wx.showToast({ title: '数量要大于 0', icon: 'none' })
      return
    }
    if (form.date > date.today()) {
      wx.showToast({ title: '不能记录未来的日期', icon: 'none' })
      return
    }
    this.setData({ saving: true })

    const duration = form.durationMin === '' ? null : parseInt(form.durationMin, 10)
    const payload = {
      date: form.date,
      shapeId: form.shapeId,
      count: form.count,
      note: form.note,
      tagIds: form.tagIds,
      durationMin: isNaN(duration) ? null : duration
    }

    if (this.data.editing) {
      db.updateCheckIn(this._recordId, payload)
      this.syncPhotos(this._recordId, form.photos)
      wx.showToast({ title: '已保存', icon: 'success' })
    } else {
      const rec = db.addCheckIn(payload)
      this.syncPhotos(rec.id, form.photos)
      wx.vibrateShort({ type: 'light' })
      wx.showToast({ title: '打卡成功，今天做了 ' + payload.count + ' 个', icon: 'none' })
    }

    setTimeout(() => wx.navigateBack(), 700)
  },

  onDelete() {
    wx.showModal({
      title: '删除这条打卡？',
      content: '删除后进入回收站，30 天内可以恢复。',
      confirmColor: '#D03B3B',
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        db.softDeleteCheckIn(this._recordId)
        wx.showToast({ title: '已移入回收站', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 700)
      }
    })
  },

  /** 编辑时的照片差异同步：删掉移除的、补上新加的 */
  syncPhotos(checkInId, photos) {
    if (!checkInId) return
    const existing = db.listPhotos(checkInId)
    const keep = photos.map((p) => p.id).filter(Boolean)
    existing.forEach((p) => {
      if (keep.indexOf(p.id) === -1) db.removePhoto(p.id)
    })
    const added = photos.filter((p) => !p.id)
    if (added.length) {
      db.addPhotos(
        checkInId,
        added.map((p) => ({ url: p.url, localPath: p.url }))
      )
    }
  }
})

const db = require('../../../utils/db')
const { SHAPE_COLORS } = require('../../../utils/constants')

Page({
  data: {
    theme: 'light',
    tags: [],
    palette: SHAPE_COLORS.light,
    showEditor: false,
    editingId: '',
    form: { name: '', color: '#898781' }
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme })
    this._unsub = db.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    this.load()
  },

  load() {
    const used = {}
    db.aliveCheckIns().forEach((c) => {
      (c.tagIds || []).forEach((t) => {
        used[t] = (used[t] || 0) + 1
      })
    })
    const tags = db.listTags().map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      isBuiltin: t.isBuiltin,
      used: used[t.id] || 0
    }))
    this.setData({ tags: tags })
  },

  onAdd() {
    this.setData({ showEditor: true, editingId: '', form: { name: '', color: '#898781' } })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const t = db.listTags().find((x) => x.id === id)
    if (!t) return
    this.setData({ showEditor: true, editingId: id, form: { name: t.name, color: t.color } })
  },

  onClose() {
    this.setData({ showEditor: false })
  },

  /** 空函数：只为了拦住弹层里点击往遮罩冒泡（catchtap 自己也会触发 handler） */
  onStop() {},

  onName(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onColor(e) {
    this.setData({ 'form.color': e.currentTarget.dataset.color })
  },

  onSave() {
    const name = (this.data.form.name || '').trim()
    if (!name) {
      wx.showToast({ title: '给标签起个名字', icon: 'none' })
      return
    }
    if (this.data.editingId) {
      db.saveTag({ id: this.data.editingId, name: name, color: this.data.form.color })
    } else {
      db.saveTag({ name: name, color: this.data.form.color })
    }
    this.setData({ showEditor: false })
    this.load()
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const tag = db.listTags().find((x) => x.id === id)
    if (!tag) return
    if (tag.isBuiltin) {
      wx.showToast({ title: '内置标签不能删除，可以改名', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除标签「' + tag.name + '」？',
      content: '已有记录上的这个标签会一并移除。',
      confirmColor: '#D03B3B',
      success: (res) => {
        if (!res.confirm) return
        db.removeTag(id)
        this.load()
      }
    })
  }
})

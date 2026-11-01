const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const { SHAPE_COLORS } = require('../../../utils/constants')

const ICONS = ['🎨', '🧸', '🙂', '🧍', '🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '✨', '🌸', '🍀', '⭐', '💫', '🎀']

/**
 * 自定义品类专用的色槽。
 *
 * <p>内置四个品类占了 0~3，剩下的 4~7 给自定义品类，
 * **固定顺序、不循环**——设计规范里就是这么定的：分类颜色按实体固定，
 * 不能按排名重新分配，否则一个品类的颜色会随别人增删而变。
 * 所以自定义品类最多 4 个，第 5 个直接不给了，而不是复用色槽。
 */
const USER_SLOTS = [4, 5, 6, 7]

Page({
  data: {
    theme: 'light',
    shapes: [],
    icons: ICONS,
    showEditor: false,
    editingId: '',
    form: {
      name: '',
      icon: '🎨',
      iconPath: '',
      slot: 0
    },
    palette: []
  },

  onLoad() {
    this.setData({
      theme: getApp().globalData.theme,
      palette: SHAPE_COLORS.light
    })
    this._unsub = db.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    this.load()
  },

  load() {
    const theme = this.data.theme
    const used = {}
    db.aliveCheckIns().forEach((c) => {
      used[c.shapeId] = (used[c.shapeId] || 0) + c.count
    })
    const shapes = db.listShapes().map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      iconPath: s.iconPath || '',
      isBuiltin: s.isBuiltin,
      slot: s.slot,
      color: stat.shapeColor(s, theme),
      used: used[s.id] || 0
    }))
    this.setData({ shapes: shapes })
  },

  onAdd() {
    const usedSlots = db.listShapes().map((s) => s.slot)
    const free = USER_SLOTS.filter((s) => usedSlots.indexOf(s) === -1)
    if (!free.length) {
      wx.showToast({ title: '自定义品类最多 4 个', icon: 'none' })
      return
    }
    this.setData({
      showEditor: true,
      editingId: '',
      form: { name: '', icon: '🎨', iconPath: '', slot: free[0] }
    })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const s = db.getShape(id)
    if (!s) return
    this.setData({
      showEditor: true,
      editingId: id,
      form: {
        name: s.name,
        icon: s.icon || '🎨',
        // 内置品类的 svg 只是默认图标：没动图标就原样留着，
        // 用户自己挑了图标才换成他的选择（见 onIcon）
        iconPath: s.iconPath || '',
        slot: s.slot || 0
      }
    })
  },

  onClose() {
    this.setData({ showEditor: false })
  },

  onName(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onIcon(e) {
    // 用户自己挑了图标，就用他的选择——内置品类默认的 svg 让位。
    // 不挑图标时 svg 保留（form.iconPath 原样带着）。
    this.setData({
      'form.icon': e.currentTarget.dataset.icon,
      'form.iconPath': ''
    })
  },

  onSlot(e) {
    this.setData({ 'form.slot': Number(e.currentTarget.dataset.slot) })
  },

  onSave() {
    const name = (this.data.form.name || '').trim()
    if (!name) {
      wx.showToast({ title: '给这个分类起个名字', icon: 'none' })
      return
    }
    // 不带 defaultPrice：db.saveShape 是 merge，已存的值不会被抹掉。
    // 单价本期没有设置入口（成本与利润是 P2），但字段留着给同步与将来用。
    const payload = {
      name: name,
      icon: this.data.form.icon,
      iconPath: this.data.form.iconPath || '',
      slot: this.data.form.slot
    }
    if (this.data.editingId) {
      db.saveShape(Object.assign({ id: this.data.editingId }, payload))
    } else {
      db.saveShape(payload)
    }
    this.setData({ showEditor: false })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.load()
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const shape = db.getShape(id)
    if (!shape) return
    if (shape.isBuiltin) {
      wx.showToast({ title: '内置分类不能删除，可以改名', icon: 'none' })
      return
    }
    const used = db.aliveCheckIns().filter((c) => c.shapeId === id).length
    wx.showModal({
      title: '删除「' + shape.name + '」？',
      content: used
        ? '有 ' + used + ' 条记录用了这个分类，历史记录会移到「其他」。'
        : '删除后可以重新添加。',
      confirmColor: '#D03B3B',
      success: (res) => {
        if (!res.confirm) return
        db.removeShape(id, 'shape_other')
        this.load()
      }
    })
  },

  onMoveUp(e) {
    const id = e.currentTarget.dataset.id
    const ids = db.listShapes().map((s) => s.id)
    const i = ids.indexOf(id)
    if (i <= 0) return
    ids.splice(i - 1, 0, ids.splice(i, 1)[0])
    db.reorderShapes(ids)
    this.load()
  },

  onMoveDown(e) {
    const id = e.currentTarget.dataset.id
    const ids = db.listShapes().map((s) => s.id)
    const i = ids.indexOf(id)
    if (i < 0 || i >= ids.length - 1) return
    ids.splice(i + 1, 0, ids.splice(i, 1)[0])
    db.reorderShapes(ids)
    this.load()
  }
})

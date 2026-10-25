const app = getApp()
const db = require('../../../utils/db')
const date = require('../../../utils/date')

Page({
  data: {
    theme: 'light',
    id: '',
    material: null,
    name: '',
    note: '',
    folderNames: ['未分类'],
    folderIndex: 0
  },

  onLoad(options) {
    this.setData({ theme: app.globalData.theme, id: options.id || '' })
    this._unsub = db.subscribe(() => this.load())
    this.load()
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
    const m = db.getMaterial(this.data.id)
    if (!m) {
      this.setData({ material: null })
      return
    }
    const folders = db.listFolders()
    // 第一个选项是「未分类」，其余是用户文件夹
    const folderNames = ['未分类'].concat(folders.map((f) => f.name))
    const folderIndex = folders.findIndex((f) => f.id === m.folderId) + 1

    this.setData({
      material: {
        id: m.id,
        url: m.url,
        name: m.name || '',
        note: m.note || '',
        createdAt: date.friendly(new Date(m.createdAt).toISOString().slice(0, 10)),
        folderName: folders.find((f) => f.id === m.folderId)
          ? folders.find((f) => f.id === m.folderId).name
          : '未分类'
      },
      name: m.name || '',
      note: m.note || '',
      folderNames: folderNames,
      folderIndex: folderIndex > -1 ? folderIndex : 0
    })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  onFolderChange(e) {
    const index = Number(e.detail.value)
    this.setData({ folderIndex: index })
  },

  onSave() {
    const folders = db.listFolders()
    // folderIndex 0 表示未分类，其余对应 folders[index-1]
    const folderId = this.data.folderIndex > 0 ? folders[this.data.folderIndex - 1].id : ''
    db.updateMaterial(this.data.id, {
      name: (this.data.name || '').trim().slice(0, 30),
      note: (this.data.note || '').slice(0, 100),
      folderId: folderId
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onDelete() {
    wx.showModal({
      title: '删除这张素材？',
      content: '删除后进回收站，30 天内可以恢复。',
      confirmColor: '#D03B3B',
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        db.removeMaterial(this.data.id)
        wx.showToast({ title: '已移入回收站', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  },

  onPreview() {
    wx.previewImage({ current: this.data.material.url, urls: [this.data.material.url] })
  }
})

const app = getApp()
const db = require('../../../utils/db')
const photos = require('../../../utils/photos')

Page({
  data: {
    theme: 'light',
    folderId: '',
    folder: null,
    title: '全部素材',
    materials: [],
    showFolder: false
  },

  onLoad(options) {
    // folderId 为空字符串表示「未分类」，undefined 表示「全部素材」
    const hasParam = options && Object.prototype.hasOwnProperty.call(options, 'folderId')
    this.setData({
      theme: app.globalData.theme,
      folderId: hasParam ? options.folderId : null,
      showFolder: !hasParam
    })
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
    const folderId = this.data.folderId
    const folder = folderId ? db.getFolder(folderId) : null
    const folderMap = {}
    db.listFolders().forEach((f) => {
      folderMap[f.id] = f.name
    })

    const filter = { keyword: '' }
    if (folderId !== null) filter.folderId = folderId

    const materials = db.listMaterials(filter).map((m) => ({
      id: m.id,
      url: m.url,
      name: m.name || '未命名素材',
      folderName: folderMap[m.folderId] || '未分类'
    }))

    this.setData({
      folder: folder,
      title: folder ? folder.name : (folderId === null ? '全部素材' : '未分类'),
      materials: materials
    })

    wx.setNavigationBarTitle({ title: folder ? folder.name : '素材' })
  },

  goMaterial(e) {
    wx.navigateTo({ url: '/pages/material/detail/index?id=' + e.currentTarget.dataset.id })
  },

  async onAddMaterial() {
    const folderId = this.data.folderId || ''
    const paths = await photos.pickImages(9)
    if (!paths.length) return
    const base = db.listMaterials({ folderId: folderId }).length
    const items = paths.map((url, i) => ({ url: url, name: '素材 ' + (base + i + 1) }))
    db.addMaterials(folderId, items)
    wx.showToast({ title: '已添加 ' + items.length + ' 张', icon: 'none' })
    this.load()
  },

  onEditFolder() {
    const folder = this.data.folder
    if (!folder) return
    const self = this
    wx.showActionSheet({
      itemList: ['重命名文件夹', '删除文件夹'],
      success: (res) => {
        if (res.tapIndex === 0) self.onRename(folder)
        else self.onDeleteFolder(folder)
      }
    })
  },

  onRename(folder) {
    wx.showModal({
      title: '重命名文件夹',
      editable: true,
      content: folder.name,
      placeholderText: '文件夹名',
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '文件夹名不能为空', icon: 'none' })
          return
        }
        db.updateFolder(folder.id, { name: name.slice(0, 20) })
        this.load()
      }
    })
  },

  onDeleteFolder(folder) {
    wx.showModal({
      title: '删除「' + folder.name + '」？',
      content: '文件夹里的素材会移到「未分类」，不会被删除。',
      confirmColor: '#D03B3B',
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        db.removeFolder(folder.id)
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
      }
    })
  }
})

const app = getApp()
const db = require('../../utils/db')
const photos = require('../../utils/photos')

Page({
  data: {
    theme: 'light',
    tab: 'folders',
    folders: [],
    materials: [],
    counts: { counts: {}, unfiled: 0, total: 0 },
    keyword: ''
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
    this.load()
  },

  onAppThemeChange(theme) {
    this.setData({ theme: theme })
    this.load()
  },

  load() {
    const counts = db.materialCounts()
    const folders = db.listFolders().map((f) => {
      const list = db.listMaterials({ folderId: f.id })
      return {
        id: f.id,
        name: f.name,
        count: counts.counts[f.id] || 0,
        cover: list.length ? list[0].url : ''
      }
    })

    const materials = db.listMaterials({ keyword: this.data.keyword }).map((m) => ({
      id: m.id,
      url: m.url,
      name: m.name || '未命名素材'
    }))

    this.setData({
      folders: folders,
      materials: materials,
      counts: counts
    })
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t })
  },

  // -- 文件夹 ---------------------------------------------------------------

  onCreateFolder() {
    wx.showModal({
      title: '新建文件夹',
      editable: true,
      placeholderText: '给文件夹起个名，比如「配色参考」',
      confirmText: '创建',
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '文件夹名不能为空', icon: 'none' })
          return
        }
        db.addFolder(name.slice(0, 20))
        wx.showToast({ title: '已创建', icon: 'success' })
        this.load()
      }
    })
  },

  goFolder(e) {
    wx.navigateTo({ url: '/pages/material/list/index?folderId=' + e.currentTarget.dataset.id })
  },

  goAll() {
    wx.navigateTo({ url: '/pages/material/list/index' })
  },

  goUnfiled() {
    wx.navigateTo({ url: '/pages/material/list/index?folderId=' })
  },

  goMaterial(e) {
    wx.navigateTo({ url: '/pages/material/detail/index?id=' + e.currentTarget.dataset.id })
  },

  // -- 搜索 -----------------------------------------------------------------

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.load())
  },

  onClearSearch() {
    this.setData({ keyword: '' }, () => this.load())
  },

  // -- 添加素材 -------------------------------------------------------------

  async onAddMaterial() {
    const paths = await photos.pickImages(9)
    if (!paths.length) return
    const items = paths.map((url, i) => ({ url: url, name: '素材 ' + (db.listMaterials().length + i + 1) }))
    db.addMaterials('', items)
    wx.showToast({ title: '已添加 ' + items.length + ' 张', icon: 'none' })
    this.setData({ tab: 'all' }, () => this.load())
  }
})

const app = getApp()
const db = require('../../../utils/db')
const stat = require('../../../utils/stat')
const date = require('../../../utils/date')
const auth = require('../../../utils/auth')

Page({
  data: {
    theme: 'light',
    // 当前是第几个 tab，用于把选中态同步给悬浮 tab bar
    tabIndex: 3,
    totals: null,
    inventory: [],
    trashCount: 0,
    cloudEnabled: false,
    shapeCount: 0,
    tagCount: 0,
    loggedIn: false,
    account: null,
    accountSub: '',
    displayName: '手作工坊访客',
    craftCode: 'CLAY-2026',
    tagNames: '',
    materialCount: 0,
    folderCount: 0,
    folders: [],
    materialPreviews: [],
    cacheSize: '0.0',
    year: ''
  },

  onLoad() {
    this.setData({ theme: app.globalData.theme })
    this._unsub = db.subscribe(() => this.load())
    this._authUnsub = auth.subscribe(() => this.load())
  },

  onUnload() {
    if (this._unsub) this._unsub()
    if (this._authUnsub) this._authUnsub()
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
    const checkIns = db.aliveCheckIns()
    const sales = db.listSales()
    const soldMap = db.soldCountByCheckIn()

    const production = checkIns.reduce((s, c) => s + c.count, 0)
    const soldCount = sales.reduce((s, x) => s + x.quantity, 0)
    const revenue = sales.reduce((s, x) => s + x.totalAmount, 0)

    // 素材库概览
    const folders = db.listFolders()
    const counts = db.materialCounts()
    const folderRows = folders.map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.counts[f.id] || 0
    }))
    // 预览图上标的是素材自己的名字，不写死分类标签
    const previews = db.listMaterials({}).slice(0, 3).map((m) => ({
      id: m.id,
      url: m.url,
      name: m.name || '未命名素材'
    }))

    // 工匠编号：按累计产量生成一个稳定的编号
    const year = date.yearOf(date.today())
    const craftCode = 'CLAY-' + year + '-' + String(Math.min(999, production))

    this.setData({
      totals: {
        production: production,
        soldCount: soldCount,
        unsold: Math.max(0, production - soldCount),
        revenue: revenue,
        records: checkIns.length,
        days: new Set(checkIns.map((c) => c.date)).size
      },
      inventory: stat.inventory(theme),
      trashCount: db.listTrash().length + db.listMaterialTrash().length,
      cloudEnabled: app.globalData.cloudEnabled,
      shapeCount: db.listShapes().length,
      tagCount: db.listTags().length,
      loggedIn: auth.isLoggedIn(),
      account: auth.getState().account,
      accountSub: auth.isLoggedIn()
        ? '微信账号已绑定 · 数据可备份到云端'
        : '数据只存在这台设备上 · 登录后自动备份',
      displayName: auth.isLoggedIn()
        ? (auth.getState().account.nickname || '微信用户')
        : '手作工坊访客',
      craftCode: craftCode,
      tagNames: db.listTags().slice(0, 3).map((t) => t.name).join(' · '),
      materialCount: counts.total,
      folderCount: folders.length,
      folders: folderRows,
      materialPreviews: previews,
      cacheSize: this.cacheSize(),
      year: year
    })
  },

  /** 本地缓存占用估算（Storage + 本地图片文件） */
  cacheSize() {
    try {
      const info = wx.getStorageInfoSync()
      const kb = (info.currentSize || 0) + (info.totalSize || 0)
      return (kb / 1024).toFixed(1)
    } catch (e) {
      return '0.0'
    }
  },

  // -- 导航 ---------------------------------------------------------------

  goMaterial() {
    wx.navigateTo({ url: '/pages/material/index' })
  },

  goShapes() {
    wx.navigateTo({ url: '/pages/mine/shapes/index' })
  },

  goTags() {
    wx.navigateTo({ url: '/pages/mine/tags/index' })
  },

  goExport() {
    wx.navigateTo({ url: '/pages/mine/export/index' })
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/stats/calendar/index' })
  },

  goAccount() {
    wx.navigateTo({ url: '/pages/mine/account/index' })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  // -- 回收站 -------------------------------------------------------------

  onRestoreTrash() {
    const trash = db.listTrash()
    const materialTrash = db.listMaterialTrash()
    if (!trash.length && !materialTrash.length) {
      wx.showToast({ title: '回收站是空的', icon: 'none' })
      return
    }
    const items = trash.map((c) => {
      const shape = db.getShape(c.shapeId)
      return '打卡 ' + c.date + ' ' + (shape ? shape.name : '') + ' × ' + c.count
    })
    materialTrash.forEach((m) => {
      items.push('素材 ' + (m.name || '未命名素材'))
    })
    // 最近删除的那条排在最前，「恢复最近一条」恢复的就是它
    const all = trash.concat(materialTrash).sort((a, b) => b.deletedAt - a.deletedAt)
    const latest = all[0]
    wx.showModal({
      title: '回收站（' + all.length + '）',
      content: items.slice(0, 8).join('\n') + (items.length > 8 ? '\n…' : ''),
      confirmText: '恢复最近一条',
      cancelText: '知道了',
      success: (res) => {
        if (!res.confirm) return
        if (latest && latest.count !== undefined) db.restoreCheckIn(latest.id)
        else if (latest) db.restoreMaterial(latest.id)
        wx.showToast({ title: '已恢复', icon: 'success' })
        this.load()
      }
    })
  },

  onPurgeTrash() {
    wx.showModal({
      title: '清空回收站？',
      content: '超过 30 天的记录会被永久删除，无法恢复。',
      confirmColor: '#D03B3B',
      success: (res) => {
        if (!res.confirm) return
        const n = db.purgeTrash()
        wx.showToast({ title: '已清理 ' + n + ' 条', icon: 'none' })
        this.load()
      }
    })
  },

  // -- 其他 ---------------------------------------------------------------

  onClearCache() {
    wx.showModal({
      title: '清除本地缓存？',
      content: '只清理图片等临时文件，不会删除任何打卡记录。',
      confirmColor: '#D03B3B',
      success: (res) => {
        if (!res.confirm) return
        try {
          wx.clearStorageSync({
            success: () => {
              wx.showToast({ title: '已清理', icon: 'success' })
              this.load()
            },
            fail: () => wx.showToast({ title: '清理失败', icon: 'none' })
          })
        } catch (e) {
          wx.showToast({ title: '清理失败', icon: 'none' })
        }
      }
    })
  },

  onShowPolicy() {
    wx.showModal({
      title: '隐私政策要点',
      content:
        '· 本应用不收集手机号，不做实名\n' +
        '· 昵称与头像只在你主动填写/选择后保存\n' +
        '· 不登录时数据仅存在你的设备上\n' +
        '· 你可以随时在「账号设置」注销并删除全部数据',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showAbout() {
    const s = auth.getState()
    wx.showModal({
      title: '捏土打卡',
      content:
        '本地优先的手作记录工具。\n\n' +
        '· 每天记录做了什么、做了几个\n' +
        '· 年度产量与营收统计\n' +
        '· 不登录也能完整使用，登录只是为了云端备份\n\n' +
        '当前状态：' +
        (s.mode === 'account' ? '已登录（微信账号）' : s.skippedLogin ? '游客模式' : '未登录') +
        '\n版本 1.3（按 PRD V1.3 实现）',
      showCancel: false
    })
  }
})

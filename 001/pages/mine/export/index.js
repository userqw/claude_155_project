const db = require('../../../utils/db')
const date = require('../../../utils/date')
const auth = require('../../../utils/auth')

Page({
  data: {
    theme: 'light',
    counts: { records: 0, sales: 0, photos: 0 },
    // 未登录：导出的是私有数据，按空处理
    locked: false
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme })
    this.refresh()
  },

  refresh() {
    if (!auth.isLoggedIn()) {
      this.setData({ locked: true, counts: { records: 0, sales: 0, photos: 0 } })
      return
    }
    const all = db.exportAll()
    this.setData({
      locked: false,
      counts: {
        records: all.checkIns.length,
        sales: all.sales.length,
        photos: all.photos.length
      }
    })
  },

  /** 未登录时不许导出 */
  guardLocked() {
    if (auth.isLoggedIn()) return false
    wx.showToast({ title: '登录后才能导出数据', icon: 'none' })
    return true
  },

  /**
   * 导出文件的落盘路径。
   *
   * <p>wx.env 是基础库 2.10.0 才有的，低版本上读 wx.env.USER_DATA_PATH
   * 会抛「undefined is not an object」。取不到就直接告诉用户不支持，
   * 别让整个导出流程崩在半路。
   */
  filePathOf(name) {
    const dir = wx.env && wx.env.USER_DATA_PATH
    if (!dir) {
      wx.showToast({ title: '当前基础库不支持导出文件', icon: 'none' })
      return ''
    }
    return `${dir}/${name}`
  },

  /** CSV：用 openDocument 打开，可以直接在 Excel / 数字表格里分析 */
  onExportCsv() {
    if (this.guardLocked()) return
    const csv = db.exportCsv()
    const name = `捏土打卡_流水_${date.today()}.csv`
    const filePath = this.filePathOf(name)
    const fs = wx.getFileSystemManager()
    fs.writeFile({
      filePath: filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.openDocument({
          filePath: filePath,
          fileType: 'csv',
          showMenu: true,
          success: () => {},
          fail: () => {
            wx.setClipboardData({
              data: csv,
              success: () => wx.showToast({ title: '已复制表格内容', icon: 'none' })
            })
          }
        })
      },
      fail: () => wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  /** JSON：完整备份，复制到剪贴板方便粘贴到任何地方 */
  onExportJson() {
    if (this.guardLocked()) return
    const json = JSON.stringify(db.exportAll(), null, 2)
    const name = `捏土打卡_备份_${date.today()}.json`
    const filePath = this.filePathOf(name)
    const fs = wx.getFileSystemManager()
    fs.writeFile({
      filePath: filePath,
      data: json,
      encoding: 'utf8',
      success: () => {
        wx.setClipboardData({
          data: json,
          success: () => {
            wx.showModal({
              title: '已复制到剪贴板',
              content: '完整备份（' + name + '）已复制，可粘贴到备忘录或网盘保存。',
              showCancel: false,
              confirmText: '知道了'
            })
          }
        })
      },
      fail: () => wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  onCopySummary() {
    const all = db.exportAll()
    const text =
      `捏土打卡 ${date.today()}\n` +
      `记录 ${all.checkIns.length} 条 · 售出 ${all.sales.length} 笔 · 照片 ${all.photos.length} 张\n` +
      `产量合计 ${all.checkIns.reduce((s, c) => s + c.count, 0)} 个`
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制摘要', icon: 'none' })
    })
  }
})

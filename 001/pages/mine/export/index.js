const db = require('../../../utils/db')
const date = require('../../../utils/date')

Page({
  data: {
    theme: 'light',
    counts: { records: 0, sales: 0, photos: 0 }
  },

  onLoad() {
    this.setData({ theme: getApp().globalData.theme })
    this.refresh()
  },

  refresh() {
    const all = db.exportAll()
    this.setData({
      counts: {
        records: all.checkIns.length,
        sales: all.sales.length,
        photos: all.photos.length
      }
    })
  },

  /** CSV：用 openDocument 打开，可以直接在 Excel / 数字表格里分析 */
  onExportCsv() {
    const csv = db.exportCsv()
    const name = `捏土打卡_流水_${date.today()}.csv`
    const filePath = `${wx.env.USER_DATA_PATH}/${name}`
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
    const json = JSON.stringify(db.exportAll(), null, 2)
    const name = `捏土打卡_备份_${date.today()}.json`
    const filePath = `${wx.env.USER_DATA_PATH}/${name}`
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

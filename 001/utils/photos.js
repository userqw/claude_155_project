/**
 * 图片选择与本地持久化。
 *
 * wx.chooseMedia 返回的 tempFilePath 会被系统回收，重启后失效，
 * 所以选完立刻用 FileSystemManager.saveFile 存成本地持久文件。
 * 本地优先的架构下，图片先落本机，云端同步是后面的事。
 */

/** 单张：临时路径 → 本地持久路径 */
function saveToLocal(tempPath) {
  const fs = wx.getFileSystemManager()
  return new Promise((resolve) => {
    const name =
      'nt_img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) + '.jpg'
    fs.saveFile({
      tempFilePath: tempPath,
      filePath: `${wx.env.USER_DATA_PATH}/${name}`,
      success: (res) => resolve({ url: res.savedFilePath, localPath: res.savedFilePath }),
      fail: () => resolve({ url: tempPath, localPath: '' })
    })
  })
}

/**
 * 弹出选择器并把选中的图片持久化。
 * @param {number} count 最多可选几张
 * @param {string} sourceType 'album' | 'camera' | 'album, camera'
 * @returns {Promise<string[]>} 本地持久路径数组
 */
function pickImages(count, sourceType) {
  const sources = sourceType || 'album, camera'
  return new Promise((resolve) => {
    const handle = (tempPaths) => {
      Promise.all(tempPaths.map(saveToLocal)).then((list) => {
        resolve(list.map((x) => x.url))
      })
    }
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: count,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: sources.split(',').map((s) => s.trim()),
        success: (res) => handle(res.tempFiles.map((f) => f.tempFilePath)),
        fail: () => resolve([])
      })
    } else {
      wx.chooseImage({
        count: count,
        sizeType: ['compressed'],
        sourceType: sources.split(',').map((s) => s.trim()),
        success: (res) => handle(res.tempFilePaths),
        fail: () => resolve([])
      })
    }
  })
}

module.exports = { saveToLocal, pickImages }

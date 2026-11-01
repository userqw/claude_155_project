/**
 * 图片选择与本地持久化。
 *
 * wx.chooseMedia 返回的 tempFilePath 会被系统回收，重启后失效，
 * 所以选完立刻用 FileSystemManager.saveFile 存成本地持久文件。
 * 本地优先的架构下，图片先落本机，云端同步是后面的事。
 */

/**
 * 单张：临时路径 → 本地持久路径
 *
 * <p>整个过程不能抛异常：抛了就是 Promise reject，
 * 上游的 Promise.all 一起挂掉，选照片的回调永远不 resolve——
 * 界面表现是「点了没反应」，比报错更难查。
 * 所以每一步都兜住，失败就退回临时路径（功能降级但不卡死）。
 */
function saveToLocal(tempPath) {
  return new Promise((resolve) => {
    let fs = null
    try {
      fs = wx.getFileSystemManager()
    } catch (e) {
      resolve({ url: tempPath, localPath: '' })
      return
    }
    if (!fs || typeof fs.saveFile !== 'function') {
      resolve({ url: tempPath, localPath: '' })
      return
    }
    try {
      // **不指定 filePath**：让微信自己分配到「本地文件」目录，
      // 那个目录重启后还在，正是我们要的持久化。
      //
      // 之前这里写的是 `${wx.env.USER_DATA_PATH}/${name}`：
      // 1) wx.env 是 2.10.0 才有的，低版本基础库上 wx.env 是 undefined，
      //    读 USER_DATA_PATH 直接抛「undefined is not an object」——
      //    真机上的报错原文，登录页选头像时必崩；
      // 2) 存到 USER_DATA_PATH 里的文件照样可能被系统清理，
      //    反而不如微信自己的本地文件目录稳。
      fs.saveFile({
        tempFilePath: tempPath,
        success: (res) => resolve({ url: res.savedFilePath, localPath: res.savedFilePath }),
        fail: () => resolve({ url: tempPath, localPath: '' })
      })
    } catch (e) {
      resolve({ url: tempPath, localPath: '' })
    }
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
      Promise.all(tempPaths.map(saveToLocal))
        .then((list) => resolve(list.map((x) => x.url)))
        // 兜底：万一有一张挂了，也要把其余的交回去，不能整个卡住
        .catch(() => resolve(tempPaths))
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

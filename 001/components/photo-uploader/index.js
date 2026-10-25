const { MAX_PHOTOS } = require('../../utils/constants')
const photos = require('../../utils/photos')

/**
 * 照片选择器。
 *
 * 本地优先：选中的照片立刻用 FileSystemManager.saveFile 存成本地持久文件，
 * 避免临时路径在重启后失效（wx.chooseMedia 返回的 tempFilePath 会被回收）。
 * 选图与持久化的实现见 utils/photos.js，素材库共用同一套。
 */
Component({
  properties: {
    photos: { type: Array, value: [] },
    max: { type: Number, value: MAX_PHOTOS },
    theme: { type: String, value: 'light' }
  },

  data: {
    busy: false
  },

  methods: {
    async onAdd() {
      const remain = this.data.max - this.data.photos.length
      if (remain <= 0) return
      this.setData({ busy: true })
      const paths = await photos.pickImages(remain)
      this.setData({ busy: false })
      if (!paths.length) return
      const next = this.data.photos
        .concat(paths.map((url) => ({ url: url, localPath: url })))
        .slice(0, this.data.max)
      this.triggerEvent('change', { photos: next })
    },

    onRemove(e) {
      const id = e.currentTarget.dataset.id
      const photo = this.data.photos.find((p) => p.id === id)
      const self = this
      wx.showModal({
        title: '删除这张照片？',
        content: '删除后不可恢复。',
        confirmColor: '#D03B3B',
        success: (res) => {
          if (!res.confirm) return
          const next = self.data.photos.filter((p) => p.id !== id)
          self.triggerEvent('change', { photos: next, removedId: id, removed: photo })
        }
      })
    },

    onPreview(e) {
      const url = e.currentTarget.dataset.url
      const urls = this.data.photos.map((p) => p.url)
      wx.previewImage({ current: url, urls: urls })
    }
  }
})

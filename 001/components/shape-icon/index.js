/**
 * 造型图标：SVG 图片优先，没有图片就退回 emoji。
 *
 * 小程序里 SVG 不能当文本用，得存成文件再用 <image> 渲染；
 * 某些低端机对 SVG 支持不稳，所以加载失败时回落到 emoji，保证永远有图。
 */
Component({
  properties: {
    // 传整个造型对象，或直接传路径
    shape: { type: Object, value: null },
    path: { type: String, value: '' },
    emoji: { type: String, value: '' },
    size: { type: String, value: 'md' }
  },

  data: {
    failed: false
  },

  observers: {
    'shape,path': function () {
      // 图标换了就重置失败标记，重新尝试加载
      this.setData({ failed: false })
    }
  },

  methods: {
    onError() {
      this.setData({ failed: true })
    }
  }
})

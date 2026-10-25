/**
 * 自定义悬浮 tab bar（原生 tabBar 加 "custom": true 后接管）。
 *
 * 两个要点：
 *   1. 必须有 theme 属性——wxml 根节点带 theme-{{theme}} 类，
 *      主题变量（--surface / --accent-grad / --glass-strong…）全靠它。
 *      没有这个属性，类名会渲染成 theme-，所有变量取不到值，
 *      tab bar 会变成透明、无定位的「隐身」状态。
 *   2. 每个 tab 页在 onShow 里同步状态：
 *      this.getTabBar().setData({ selected: n, theme: this.data.theme })
 */
Component({
  properties: {
    theme: { type: String, value: '' }
  },

  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
      { pagePath: '/pages/stats/year/index', text: '年度', icon: '📈' },
      { pagePath: '/pages/library/list/index', text: '作品库', icon: '🖼' },
      { pagePath: '/pages/mine/index/index', text: '我的', icon: '🎀' }
    ]
  },

  lifetimes: {
    attached() {
      // 兜底：页面忘了传 theme 时，自己从 app 上取一次
      if (!this.data.theme) {
        try {
          const app = getApp()
          if (app && app.globalData) {
            this.setData({ theme: app.globalData.theme || 'light' })
          }
        } catch (e) {
          this.setData({ theme: 'light' })
        }
      }
    }
  },

  methods: {
    onTap(e) {
      const { index, path } = e.currentTarget.dataset
      if (index === this.data.selected) return
      wx.switchTab({ url: path })
    }
  }
})

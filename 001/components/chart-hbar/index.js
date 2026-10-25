/**
 * 横向条形图（用 view 实现，不用 canvas）。
 *
 * 分类占比这类「一个度量、若干名义分类」的场景用条形图最合适。
 * 颜色跟随分类实体固定分配（筛选后不重新着色），
 * 分类名直接标在左侧，识别不依赖颜色单独承担。
 *
 * 规范：条厚 ≤ 24px、数据端 4px 圆角、基线端方角、条间靠行距留白分隔。
 *
 * 两种布局：
 *   stacked = false（默认）——左名称 / 中进度条 / 右数值，一行排开。
 *   stacked = true ——原型的两行式：上行名称与数值分列两侧，下行一条通栏进度条。
 */
Component({
  properties: {
    items: { type: Array, value: [] },
    theme: { type: String, value: 'light' },
    showPercent: { type: Boolean, value: true },
    unit: { type: String, value: '' },
    stacked: { type: Boolean, value: false }
  },

  observers: {
    // unit 也列进来：属性是逐个下发的，只监听 items 的话
    // 首次渲染可能拿到还没落地的 unit，导致单位缺失。
    'items,theme,showPercent,unit': function (items, theme, showPercent, unit) {
      this.setData({ rows: this.buildRows(items, unit) })
    }
  },

  data: {
    rows: []
  },

  methods: {
    buildRows(list, unit) {
      if (!Array.isArray(list) || !list.length) return []
      const u = typeof unit === 'string' ? unit : this.data.unit || ''
      const max = Math.max.apply(
        null,
        list.map((d) => Number(d.value) || 0)
      )
      const total = list.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
      return list.map((d) => {
        const value = Number(d.value) || 0
        return {
          key: d.key || d.name,
          name: d.name,
          color: d.color || '#898781',
          value: value,
          // 调用方可以自带展示文案（比如金额格式化的「¥1,280」）
          display: d.display != null ? d.display : String(value) + u,
          percentText: d.percentText != null ? d.percentText : total ? Math.round((value / total) * 100) + '%' : '0%',
          ratio: max > 0 ? Math.max(1.5, (value / max) * 100) : 0
        }
      })
    }
  }
})

const { withAlpha } = require('../../utils/color')

/**
 * 造型选择器：四列网格，单选。
 * 颜色跟随分类实体固定分配（DB 里存的 slot），选中与未选中都不重新着色；
 * 选中态用描边 + 上浮表达，不靠换色。
 */
Component({
  properties: {
    shapes: { type: Array, value: [] },
    value: { type: String, value: '' },
    theme: { type: String, value: 'light' }
  },

  observers: {
    shapes: function (shapes) {
      const list = (shapes || []).map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        iconPath: s.iconPath || '',
        color: s.color || '#F58BA8',
        softColor: withAlpha(s.color || '#F58BA8', 0.18)
      }))
      this.setData({ list: list })
    }
  },

  data: {
    list: []
  },

  methods: {
    onSelect(e) {
      const id = e.currentTarget.dataset.id
      if (id === this.data.value) return
      this.triggerEvent('change', { value: id })
    }
  }
})

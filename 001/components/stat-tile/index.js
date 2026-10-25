/**
 * 统计数值卡片。
 * 契约：label（可选）· value（半ibold）· unit · sub（可选补充）· note（状态点 + 说明）· delta（可选）。
 * 带 icon 时右上角出现圆形图标徽章——这是原型里的主视觉。
 *
 * 状态点颜色两种给法：
 *   dotColor —— 直接给色值（分类色等场景，颜色跟着分类实体走）
 *   dotTone  —— 给语义名（'accent' | 'accent2' | 'good' | 'danger'），
 *               由组件自己的 wxss 映射到主题变量，暗色模式自动成立。
 */
Component({
  properties: {
    label: { type: String, value: '' },
    value: { type: String, value: '' },
    unit: { type: String, value: '' },
    sub: { type: String, value: '' },
    note: { type: String, value: '' },
    icon: { type: String, value: '' },
    dotColor: { type: String, value: '#F58BA8' },
    dotTone: { type: String, value: '' },
    delta: { type: String, value: '' },
    // 'up' | 'down' | 'flat'
    deltaTone: { type: String, value: 'flat' },
    theme: { type: String, value: 'light' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap')
    }
  }
})

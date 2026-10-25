const canvas = require('../../utils/canvas')
const { niceMax } = require('../../utils/format')
const { THEME } = require('../../utils/constants')

/**
 * 柱状图（column chart）。
 *
 * 适用：月度产量、月度营收这类「随时间变化 + 单一度量」的场景。
 * 规范：
 *   - 柱厚 ≤ 24px，柱间留 2px 表面色间隙（用留白分隔，不描边）
 *   - 数据端 4px 圆角，基线端方角
 *   - 网格线为 1px 实线，颜色比表面深一档
 *   - 数值用文本色直接标注在柱顶（颜色浅的系列对比度不足 3:1，必须直接标值）
 *   - 点击柱子显示数值气泡，气泡只做增强，所有数值也能在页面表格里读到
 */
Component({
  properties: {
    items: { type: Array, value: [] },
    theme: { type: String, value: 'light' },
    height: { type: Number, value: 180 },
    unit: { type: String, value: '' },
    // extreme: 只标注最高的那根；all: 每根都标；none: 靠坐标轴
    labelMode: { type: String, value: 'extreme' },
    format: { type: String, value: 'int' },
    activeIndex: { type: Number, value: -1 }
  },

  observers: {
    'items,theme,height,labelMode,format': function () {
      if (this._ready) this.draw()
    }
  },

  data: {},

  lifetimes: {
    attached() {
      this._ready = false
    },
    ready() {
      this._ready = true
      this.draw()
    }
  },

  methods: {
    fmtValue(v) {
      if (this.data.format === 'money') {
        return '¥' + (Math.round(v * 100) / 100).toLocaleString()
      }
      return String(Math.round(v * 10) / 10)
    },

    draw() {
      const theme = THEME[this.data.theme] || THEME.light
      const items = this.data.items || []
      if (!items.length) return

      canvas.setup(this, '#chart', (ctx, w, h) => {
        const pl = 34
        const pr = 10
        const pt = 24
        const pb = 22
        const plotW = w - pl - pr
        const plotH = h - pt - pb
        if (plotW <= 0 || plotH <= 0) return

        const values = items.map((d) => Number(d.value) || 0)
        const scale = niceMax(Math.max.apply(null, values), 4)
        const max = scale.max || 1
        const n = items.length
        const band = plotW / n
        // 2px 表面间隙 + 两侧留白，柱厚再封顶 24px
        const barW = Math.max(4, Math.min(24, band - 8))

        // 网格线与左轴刻度
        canvas.drawGrid(ctx, { left: pl, right: w - pr, top: pt, bottom: pt + plotH, max: max, step: scale.step, theme: theme })

        const maxIdx = values.indexOf(Math.max.apply(null, values))
        const labelAll = this.data.labelMode === 'all'

        ctx.save()
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'

        items.forEach((d, i) => {
          const v = Number(d.value) || 0
          const cx = pl + band * i + band / 2
          const barH = max > 0 ? (v / max) * plotH : 0
          const y = pt + plotH - barH
          const x = cx - barW / 2
          const color = d.color || theme.accent
          const isActive = this.data.activeIndex === i
          const dim = this.data.activeIndex > -1 && !isActive

          // 柱体：数据端（上）圆角，基线端方角
          if (barH > 0) {
            ctx.globalAlpha = dim ? 0.35 : 1
            ctx.fillStyle = color
            canvas.roundRectPath(ctx, x, y, barW, barH, 4, { tl: true, tr: true })
            ctx.fill()
            ctx.globalAlpha = 1
          }

          // 柱顶数值
          const showLabel = labelAll || (this.data.labelMode === 'extreme' && i === maxIdx && v > 0)
          if (showLabel) {
            ctx.fillStyle = theme.textPrimary
            ctx.textBaseline = 'bottom'
            ctx.fillText(this.fmtValue(v), cx, y - 4)
          }

          // x 轴标签：太密时隔一个显示
          const skip = band < 24 && n > 8 ? 2 : 1
          if (i % skip === 0) {
            ctx.fillStyle = theme.textMuted
            ctx.textBaseline = 'top'
            ctx.fillText(d.label, cx, pt + plotH + 6)
          }
        })
        ctx.restore()

        // 基线
        canvas.drawBaseline(ctx, { left: pl, right: w - pr, bottom: pt + plotH, theme: theme })

        this._layout = { pl, pr, pt, pb, plotW, plotH, band, barW, max, n, items }
      })
    },

    onTap(e) {
      const layout = this._layout
      if (!layout) return
      const tap = e.detail && e.detail.x != null ? e.detail : e.touches && e.touches[0]
      if (!tap) return
      const x = tap.x
      let idx = Math.floor((x - layout.pl) / layout.band)
      if (idx < 0 || idx >= layout.n) return
      const item = layout.items[idx]
      this.triggerEvent('select', { index: idx, item: item })
    }
  }
})

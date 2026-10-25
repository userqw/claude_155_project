const canvas = require('../../utils/canvas')
const { niceMax } = require('../../utils/format')
const { THEME } = require('../../utils/constants')

/**
 * 折线图：用于「按月营收」这类连续趋势。
 *
 * 规范：
 *   - 线宽 2px，圆角连接
 *   - 端点 marker 直径 ≥ 8px，带 2px 表面色描环（压线时仍然清晰）
 *   - 面积填充用线色 10% 淡色，不铺实色块
 *   - 只标注极值点和末点，不是每个点都标数字
 */
Component({
  properties: {
    items: { type: Array, value: [] },
    theme: { type: String, value: 'light' },
    height: { type: Number, value: 180 },
    format: { type: String, value: 'money' },
    color: { type: String, value: '' }
  },

  observers: {
    'items,theme,height,format,color': function () {
      if (this._ready) this.draw()
    }
  },

  data: {},

  lifetimes: {
    ready() {
      this._ready = true
      this.draw()
    }
  },

  methods: {
    fmtValue(v) {
      if (this.data.format === 'money') {
        const n = Math.round(v * 100) / 100
        return '¥' + (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2))
      }
      return String(Math.round(v * 10) / 10)
    },

    draw() {
      const theme = THEME[this.data.theme] || THEME.light
      const items = this.data.items || []
      if (!items.length) return
      const color = this.data.color || theme.accent

      canvas.setup(this, '#chart', (ctx, w, h) => {
        const pl = 46
        const pr = 14
        const pt = 26
        const pb = 22
        const plotW = w - pl - pr
        const plotH = h - pt - pb
        if (plotW <= 0 || plotH <= 0) return

        const values = items.map((d) => Number(d.value) || 0)
        const scale = niceMax(Math.max.apply(null, values), 4)
        const max = scale.max || 1
        const n = items.length
        const stepX = n > 1 ? plotW / (n - 1) : 0

        canvas.drawGrid(ctx, { left: pl, right: w - pr, top: pt, bottom: pt + plotH, max: max, step: scale.step, theme: theme })

        const points = items.map((d, i) => ({
          x: pl + stepX * i,
          y: pt + plotH - ((Number(d.value) || 0) / max) * plotH,
          value: Number(d.value) || 0,
          label: d.label
        }))

        // 面积淡色填充（线色 10%）
        if (points.length > 1) {
          ctx.save()
          ctx.globalAlpha = 0.1
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(points[0].x, pt + plotH)
          points.forEach((p) => ctx.lineTo(p.x, p.y))
          ctx.lineTo(points[points.length - 1].x, pt + plotH)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }

        // 折线
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
        ctx.stroke()
        ctx.restore()

        // marker：直径 8px + 2px 表面色描环
        const maxIdx = values.indexOf(Math.max.apply(null, values))
        const lastIdx = points.length - 1
        points.forEach((p, i) => {
          ctx.save()
          ctx.beginPath()
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = theme.surface
          ctx.stroke()
          ctx.restore()
        })

        // 只标注极值与末点
        ctx.save()
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = theme.textPrimary
        const marks = {}
        if (values[maxIdx] > 0) marks[maxIdx] = true
        marks[lastIdx] = true
        Object.keys(marks).forEach((k) => {
          const i = Number(k)
          const p = points[i]
          const text = this.fmtValue(p.value)
          const tw = ctx.measureText(text).width
          let x = p.x
          if (x - tw / 2 < pl) x = pl + tw / 2
          if (x + tw / 2 > w - pr) x = w - pr - tw / 2
          ctx.fillText(text, x, p.y - 8)
        })
        ctx.restore()

        // x 轴标签
        ctx.save()
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = theme.textMuted
        const skip = stepX < 26 && n > 8 ? 2 : 1
        points.forEach((p, i) => {
          if (i % skip === 0) ctx.fillText(p.label, p.x, pt + plotH + 6)
        })
        ctx.restore()

        canvas.drawBaseline(ctx, { left: pl, right: w - pr, bottom: pt + plotH, theme: theme })

        this._layout = { pl, pr, pt, plotH, stepX, n, points, items }
      })
    },

    onTap(e) {
      const layout = this._layout
      if (!layout || layout.n === 0) return
      const tap = e.detail && e.detail.x != null ? e.detail : e.touches && e.touches[0]
      if (!tap) return
      let idx = 0
      if (layout.stepX > 0) {
        idx = Math.round((tap.x - layout.pl) / layout.stepX)
      }
      if (idx < 0) idx = 0
      if (idx > layout.n - 1) idx = layout.n - 1
      this.triggerEvent('select', { index: idx, item: layout.items[idx] })
    }
  }
})

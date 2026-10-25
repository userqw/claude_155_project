/**
 * Canvas 2D 绘图工具。
 *
 * 遵循 dataviz skill 的 mark 规范：
 *   - 柱条 ≤ 24px 厚，数据端 4px 圆角、基线端为方角
 *   - 网格线为一档灰的 1px 实线（不用虚线）
 *   - 相邻柱之间留 2px 表面色间隙，用留白分隔而不是描边
 *   - 文字一律使用文本色令牌，绝不穿数据色
 */

function pixelRatio() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    return info.pixelRatio || 2
  } catch (e) {
    return 2
  }
}

/**
 * 取得 canvas 节点并按 dpr 放大位图尺寸。
 * @param {object} component 调用方组件实例（用于 .in() 限定作用域）
 * @param {string} selector canvas 的 id 或 class 选择器
 * @param {function} cb (ctx, width, height) => void，width/height 为 CSS 像素
 */
function setup(component, selector, cb) {
  wx.createSelectorQuery()
    .in(component)
    .select(selector)
    .fields({ node: true, size: true })
    .exec((res) => {
      const item = res && res[0]
      if (!item || !item.node) {
        console.warn('[canvas] 未找到 canvas 节点', selector)
        return
      }
      const canvas = item.node
      const ctx = canvas.getContext('2d')
      const dpr = pixelRatio()
      canvas.width = Math.round(item.width * dpr)
      canvas.height = Math.round(item.height * dpr)
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, item.width, item.height)
      cb(ctx, item.width, item.height)
    })
}

/**
 * 圆角矩形路径。c = {tl, tr, br, bl} 指定哪些角画圆角。
 * 列状图：tl/tr 圆角（数据端在上），底端为方角。
 */
function roundRectPath(ctx, x, y, w, h, r, c) {
  const flags = c || {}
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
  const tl = flags.tl ? rr : 0
  const tr = flags.tr ? rr : 0
  const br = flags.br ? rr : 0
  const bl = flags.bl ? rr : 0
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.lineTo(x + w, y + h - br)
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.lineTo(x, y + tl)
  if (tl) ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

/** 网格线 + 刻度值（左轴） */
function drawGrid(ctx, opts) {
  const { left, right, top, bottom, max, step, theme } = opts
  const height = bottom - top
  const ticks = Math.round(max / step)
  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = theme.gridline
  ctx.fillStyle = theme.textMuted
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= ticks; i++) {
    const value = step * i
    const y = Math.round(bottom - (value / max) * height) + 0.5
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
    ctx.fillText(String(value), left - 6, y)
  }
  ctx.restore()
}

/** 基线（坐标轴） */
function drawBaseline(ctx, opts) {
  const { left, right, bottom, theme } = opts
  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = theme.baseline
  ctx.beginPath()
  ctx.moveTo(left, Math.round(bottom) + 0.5)
  ctx.lineTo(right, Math.round(bottom) + 0.5)
  ctx.stroke()
  ctx.restore()
}

module.exports = {
  setup,
  roundRectPath,
  drawGrid,
  drawBaseline,
  pixelRatio
}

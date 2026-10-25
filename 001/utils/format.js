/** 数值与文案格式化。 */

/** 金额：1280 -> '1,280'；12.5 -> '12.5'；整数不带小数 */
function money(n) {
  const v = Number(n) || 0
  const fixed = Math.round(v * 100) / 100
  const s = Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(2)
  const parts = s.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

/** 金额带符号：'¥1,280' */
function yuan(n) {
  return '¥' + money(n)
}

/** 大数紧凑显示：1284 -> '1,284'；12900 -> '12.9K' */
function compact(n) {
  const v = Number(n) || 0
  if (Math.abs(v) < 10000) return money(v)
  if (Math.abs(v) < 1000000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
}

function percent(part, whole, digits) {
  if (!whole) return '0%'
  const d = digits == null ? 0 : digits
  return ((part / whole) * 100).toFixed(d) + '%'
}

function plural(count, unit) {
  return count + ' ' + unit
}

/** 坐标轴刻度：取整到易读的数值 */
function niceMax(max, ticks) {
  const t = ticks || 4
  if (!max || max <= 0) return { max: 1, step: 1 }
  const raw = max / t
  const mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10))
  const norm = raw / mag
  let step
  if (norm <= 1) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 2.5) step = 2.5
  else if (norm <= 5) step = 5
  else step = 10
  step *= mag
  return { max: Math.ceil(max / step) * step, step }
}

module.exports = { money, yuan, compact, percent, plural, niceMax }

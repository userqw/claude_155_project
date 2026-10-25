/**
 * 颜色工具。
 *
 * 主要用于「色块内文字」的颜色选择：dataviz 规范里，标签压在彩色填充上时，
 * 文字只能在「白 / 近黑」两个里选，具体按填充色的相对明度决定——
 * 否则浅色块上白字会看不清（比如热力图最浅一档粉色，白字只有 1.46:1）。
 */

const NEAR_BLACK = '#3A2B45'
const WHITE = '#FFFFFF'

function hex2srgb(hex) {
  const h = String(hex || '').trim().replace(/^#/, '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

function s2lin(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 相对明度 0–1 */
function relativeLuminance(hex) {
  const [r, g, b] = hex2srgb(hex).map(s2lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 挑一个在给定底色上对比度更高的文字色（白 or 近黑）。
 * @param {string} bg 底色 hex
 * @returns {string} '#FFFFFF' 或近黑
 */
function pickTextColor(bg) {
  return contrast(WHITE, bg) >= contrast(NEAR_BLACK, bg) ? WHITE : NEAR_BLACK
}

/**
 * 给 hex 加透明度，返回 rgba() 字符串。
 * 小程序对 8 位 hex (#RRGGBBAA) 的支持不稳，统一转 rgba 更保险。
 */
function withAlpha(hex, alpha) {
  const h = String(hex || '').trim().replace(/^#/, '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((v) => isNaN(v))) return 'transparent'
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
}

module.exports = {
  NEAR_BLACK,
  WHITE,
  relativeLuminance,
  contrast,
  pickTextColor,
  withAlpha
}

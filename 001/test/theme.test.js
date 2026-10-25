/**
 * 主题回归测试（对应 PRD §8.3 视觉风格 · 二次元可爱风）
 *
 * 守住两件容易翻车的事：
 *   1. 文字对比度：正文 ≥ 4.5:1；色块内的日期数字按填充色明度选白/近黑，也 ≥ 4.5:1
 *   2. 图表分类色的色觉分离度：相邻色对 CVD ΔE ≥ 8、常视力 ΔE ≥ 15
 *
 * 第 2 条尤其重要：可爱风最容易被「这个粉更好看」说服去改色板，
 * 而色盲用户分不出相邻的两个粉，就是一次真实的可用性事故。
 *
 * 运行：node test/theme.test.js
 */
const assert = require('assert')
const path = require('path')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const color = require(path.join(root, 'utils/color.js'))
const { THEME, SHAPE_COLORS } = require(path.join(root, 'utils/constants.js'))

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log('  ✓ ' + name)
  } catch (e) {
    failed += 1
    console.log('  ✗ ' + name + '\n      ' + e.message)
    process.exitCode = 1
  }
}

// -- OKLab + CVD 模拟（与 dataviz skill 的 validate_palette.js 同口径） --------
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hex2srgb = (h) => {
  const s = String(h).trim().replace(/^#/, '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}
function oklabFromLin([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ]
}
function simulate(hex, kind) {
  const [r, g, b] = hex2srgb(hex).map(s2lin)
  const M = MACHADO[kind]
  const cl = (v) => Math.max(0, Math.min(1, v))
  return [
    cl(M[0][0] * r + M[0][1] * g + M[0][2] * b),
    cl(M[1][0] * r + M[1][1] * g + M[1][2] * b),
    cl(M[2][0] * r + M[2][1] * g + M[2][2] * b)
  ]
}
function deltaE(a, b, kind) {
  const A = oklabFromLin(kind ? simulate(a, kind) : hex2srgb(a).map(s2lin))
  const B = oklabFromLin(kind ? simulate(b, kind) : hex2srgb(b).map(s2lin))
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}

console.log('\n文字对比度（≥ 4.5:1）')

check('亮色：正文 / 次级 / 弱化文字对页面底色都达标', () => {
  const bg = THEME.light.page
  assert.ok(color.contrast(THEME.light.textPrimary, bg) >= 4.5, 'textPrimary')
  assert.ok(color.contrast(THEME.light.textSecondary, bg) >= 4.5, 'textSecondary')
  assert.ok(color.contrast(THEME.light.textMuted, bg) >= 4.5, 'textMuted')
})

check('亮色：正文 / 次级 / 弱化文字对卡片底色都达标', () => {
  const bg = THEME.light.surface
  assert.ok(color.contrast(THEME.light.textPrimary, bg) >= 4.5, 'textPrimary')
  assert.ok(color.contrast(THEME.light.textSecondary, bg) >= 4.5, 'textSecondary')
  assert.ok(color.contrast(THEME.light.textMuted, bg) >= 4.5, 'textMuted')
})

check('暗色：正文 / 次级 / 弱化文字对页面与卡片底色都达标', () => {
  ;[THEME.dark.page, THEME.dark.surface].forEach((bg) => {
    assert.ok(color.contrast(THEME.dark.textPrimary, bg) >= 4.5, 'textPrimary vs ' + bg)
    assert.ok(color.contrast(THEME.dark.textSecondary, bg) >= 4.5, 'textSecondary vs ' + bg)
    assert.ok(color.contrast(THEME.dark.textMuted, bg) >= 4.5, 'textMuted vs ' + bg)
  })
})

check('主按钮上的深紫文字对渐变两端都达标', () => {
  const onAccent = '#3A2B45'
  ;['#FFB0C8', '#CDB0F2'].forEach((c) => {
    assert.ok(color.contrast(onAccent, c) >= 4.5, onAccent + ' on ' + c)
  })
})

check('强调文字色 --accent-ink 在白底与粉底上都够清晰', () => {
  // 樱花粉本身在粉底上只有 4.4:1，粉色面上的强调文字要走 --accent-ink
  assert.ok(color.contrast('#A84663', '#FFFFFF') >= 4.5, '白底')
  assert.ok(color.contrast('#A84663', '#FFF0F6') >= 4.5, '粉底')
  assert.ok(color.contrast('#FFAFC6', '#221B2E') >= 4.5, '暗色卡片底')
})

console.log('\n色块内文字（热力图日期数字）')

check('亮色热力图每一档的日期数字都清晰（白或近黑，取对比度高的那个）', () => {
  THEME.light.heat.forEach((c) => {
    const t = color.pickTextColor(c)
    const ratio = color.contrast(t, c)
    assert.ok(ratio >= 4.5, c + ' 上的 ' + t + ' 只有 ' + ratio.toFixed(2) + ':1')
  })
})

check('暗色热力图每一档的日期数字都清晰', () => {
  THEME.dark.heat.forEach((c) => {
    const t = color.pickTextColor(c)
    const ratio = color.contrast(t, c)
    assert.ok(ratio >= 4.5, c + ' 上的 ' + t + ' 只有 ' + ratio.toFixed(2) + ':1')
  })
})

check('空心格（0 件）的日期数字也清晰', () => {
  ;[THEME.light.heatEmpty, THEME.dark.heatEmpty].forEach((c) => {
    const t = color.pickTextColor(c)
    assert.ok(color.contrast(t, c) >= 4.5, c + ' 上的 ' + t)
  })
})

console.log('\n图表分类色的色觉分离度')

;['light', 'dark'].forEach((mode) => {
  const pal = SHAPE_COLORS[mode].slice(0, 4) // 四个内置分类
  check(mode + '：相邻色对 CVD ΔE ≥ 8', () => {
    for (let i = 0; i < pal.length - 1; i++) {
      const dp = deltaE(pal[i], pal[i + 1], 'protan')
      const dd = deltaE(pal[i], pal[i + 1], 'deutan')
      const worst = Math.min(dp, dd)
      assert.ok(worst >= 8, pal[i] + '↔' + pal[i + 1] + ' ΔE ' + worst.toFixed(1) + ' < 8')
    }
  })

  check(mode + '：相邻色对常视力 ΔE ≥ 15', () => {
    for (let i = 0; i < pal.length - 1; i++) {
      const d = deltaE(pal[i], pal[i + 1])
      assert.ok(d >= 15, pal[i] + '↔' + pal[i + 1] + ' ΔE ' + d.toFixed(1) + ' < 15')
    }
  })

  // 条形图/折线按「相邻色对」判定即可（dataviz 的口径）；
  // all-pairs 是散点、气泡、地图的要求，本项目不画那类图
  check(mode + '：相邻色对常视力 ΔE ≥ 15（条形图口径）', () => {
    for (let i = 0; i < pal.length - 1; i++) {
      const d = deltaE(pal[i], pal[i + 1])
      assert.ok(d >= 15, pal[i] + '↔' + pal[i + 1] + ' ΔE ' + d.toFixed(1) + ' < 15')
    }
  })
})

console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')

/**
 * 全局常量：色板、造型分类、标签、渠道、主题令牌。
 *
 * 分类色板走二次元马卡龙风（樱花粉 / 天空蓝 / 薄荷 / 薰衣草紫），
 * 同时必须过 dataviz skill 的色觉校验——「好看」和「色盲分得清」是两件事，
 * 换色时先跑 validate_palette.js 再改这里：
 *   亮色 (surface #FFFDFB): #f68ca1 / #55bcfa / #54cb99 / #c49bf3 → ALL CHECKS PASS
 *   暗色 (surface #221B2E): #d46d83 / #2f9cd8 / #2baa7b / #a57cd2 → ALL CHECKS PASS
 * 相邻色对最差 CVD ΔE 13.3(亮) / 13.3(暗)，常视力 ΔE 16.0(亮) / 15.8(暗)，
 * 均高于 8 / 15 的硬门槛。亮色下四色对底色都低于 3:1，
 * 因此所有图表必须直接标注数值（relief 规则），不得只靠 tooltip。
 */

// -- 主题令牌 ----------------------------------------------------------------
const THEME = {
  light: {
    navigationBarBackgroundColor: '#FFFFFF',
    page: '#FFF6F0',
    surface: '#FFFFFF',
    surfaceSunken: '#FFF2F6',
    textPrimary: '#4A3A52',
    textSecondary: '#64536E',
    textMuted: '#7C6B85',
    gridline: '#F3E7EE',
    baseline: '#E4D3E0',
    border: 'rgba(198,150,190,0.26)',
    accent: '#F58BA8',
    accent2: '#B79CED',
    danger: '#E4687F',
    good: '#4FBF95',
    // 日历热力图：单一色相（樱花粉）由浅到深，0 件为空心格
    // tier3/tier4 相对 DESIGN.md 略加深：浅到中间那段无论白字还是近黑都够不到 4.5:1，
    // 加深后格内日期数字才读得清（白字 4.69 / 6.25）
    heat: ['#E5BAC1', '#DB99A4', '#B95362', '#A04056'],
    heatEmpty: '#FDF2F6'
  },
  dark: {
    navigationBarBackgroundColor: '#221B2E',
    page: '#171320',
    surface: '#221B2E',
    surfaceSunken: '#2C2339',
    textPrimary: '#F4ECF7',
    textSecondary: '#D6C8E0',
    textMuted: '#94859F',
    gridline: '#342A42',
    baseline: '#4A3D5A',
    border: 'rgba(255,255,255,0.10)',
    accent: '#F58BA8',
    accent2: '#B79CED',
    danger: '#F08A9E',
    good: '#5FCFA6',
    heat: ['#49282E', '#73414B', '#B05C6E', '#E27A8F'],
    heatEmpty: '#2C2339'
  }
}

// -- 分类色板（按实体固定，绝不按排名重新分配） ------------------------------
const SHAPE_COLORS = {
  light: ['#F68CA1', '#55BCFA', '#54CB99', '#C49BF3', '#F7B267', '#E88AC0', '#7FD1A8', '#8FB8F0'],
  dark: ['#D46D83', '#2F9CD8', '#2BAA7B', '#A57CD2', '#D99A52', '#D470A2', '#5EB88A', '#7099E0']
}

// -- 内置造型 ----------------------------------------------------------------
// PRD §5.1.1：OB11娃头 / QQ人 / 正比 为内置分类，可改名、可排序、不可删除。
const BUILTIN_SHAPES = [
  {
    id: 'shape_ob11',
    name: 'OB11娃头',
    icon: '🧸',
    // svg 图标（小程序里用 <image> 渲染，不是文本）
    iconPath: '/assets/icons/ob11.svg',
    slot: 0,
    isBuiltin: true,
    sort: 0
  },
  {
    id: 'shape_qq',
    name: 'QQ人',
    icon: '🙂',
    iconPath: '/assets/icons/qq.svg',
    slot: 1,
    isBuiltin: true,
    sort: 1
  },
  { id: 'shape_zhengbi', name: '正比', icon: '🧍', slot: 2, isBuiltin: true, sort: 2 },
  { id: 'shape_other', name: '其他', icon: '✨', slot: 3, isBuiltin: true, sort: 3 }
]

// -- 标签 --------------------------------------------------------------------
const BUILTIN_TAGS = [
  { id: 'tag_limit', name: '限定配色', color: '#EB6834', isBuiltin: true },
  { id: 'tag_practice', name: '练手', color: '#2A78D6', isBuiltin: true },
  { id: 'tag_gift', name: '送人', color: '#1BAF7A', isBuiltin: true },
  { id: 'tag_rework', name: '返工', color: '#EDA100', isBuiltin: true },
  { id: 'tag_urgent', name: '急单', color: '#E87BA4', isBuiltin: true },
  { id: 'tag_dropped', name: '已淘汰', color: '#898781', isBuiltin: true }
]

// -- 销售渠道 ----------------------------------------------------------------
const CHANNELS = [
  { id: 'xhs', name: '小红书' },
  { id: 'xianyu', name: '闲鱼' },
  { id: 'wechat', name: '微信' },
  { id: 'offline', name: '线下' },
  { id: 'other', name: '其他' }
]

// -- 数量快捷值 --------------------------------------------------------------
const QUICK_COUNTS = [1, 3, 5, 10]

// -- 约束 --------------------------------------------------------------------
const MAX_COUNT = 99
const MAX_PHOTOS = 9
const MAX_NOTE = 200
const TRASH_KEEP_DAYS = 30
const BACKUP_KEEP = 7
const MIN_DATE = '2023-01-01'

module.exports = {
  THEME,
  SHAPE_COLORS,
  BUILTIN_SHAPES,
  BUILTIN_TAGS,
  CHANNELS,
  QUICK_COUNTS,
  MAX_COUNT,
  MAX_PHOTOS,
  MAX_NOTE,
  TRASH_KEEP_DAYS,
  BACKUP_KEEP,
  MIN_DATE
}

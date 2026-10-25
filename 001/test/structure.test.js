/**
 * 结构一致性检查：
 *   1. app.json 里的页面都存在，且 tabBar 页面已注册
 *   2. 所有 usingComponents 路径可解析
 *   3. 所有 require() 的相对路径可解析
 *   4. 页面 wxml 里绑定的事件，在页面 js 里有对应处理函数
 *   5. 页面监听的自定义组件事件，组件确实 triggerEvent 了，页面也有处理函数
 *   6. 页面之间的跳转 URL 指向已注册页面
 *
 * 运行：node test/structure.test.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
process.chdir(root)
const errs = []

const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'))

// 1. 页面文件齐全
for (const p of appJson.pages) {
  for (const ext of ['.js', '.wxml', '.wxss', '.json']) {
    if (!fs.existsSync(path.join(root, p + ext))) errs.push('缺少页面文件: ' + p + ext)
  }
}
for (const t of (appJson.tabBar && appJson.tabBar.list) || []) {
  if (!appJson.pages.includes(t.pagePath)) errs.push('tabBar 页面未在 pages 中注册: ' + t.pagePath)
}

// 2 & 3. 组件路径与 require 路径
function scanJson(file) {
  let j
  try {
    j = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    errs.push('JSON 解析失败 ' + file + ': ' + e.message)
    return
  }
  for (const [name, rel] of Object.entries(j.usingComponents || {})) {
    const target = path.resolve(path.dirname(file), rel)
    if (!fs.existsSync(target + '.js') || !fs.existsSync(target + '.wxml')) {
      errs.push('usingComponents 路径无效 ' + name + ' in ' + file + ' -> ' + rel)
    }
  }
}

function scanRequires(file) {
  const src = fs.readFileSync(file, 'utf8')
  const re = /require\(['"]([^'"]+)['"]\)/g
  let m
  while ((m = re.exec(src))) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const target = path.resolve(path.dirname(file), spec)
    if (!fs.existsSync(target) && !fs.existsSync(target + '.js')) {
      errs.push('require 路径无效 ' + file + ' -> ' + spec)
    }
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.json')) scanJson(p)
    else if (e.name.endsWith('.js')) scanRequires(p)
  }
}
walk(root)

// 4. 页面与组件的事件处理函数
// 这一条防的是「点击没反应」：wxml 里 bindtap="onXxx"，但 js 里没有 onXxx，
// 小程序不会报错，只会在控制台留一句 handler not found，点起来就是没反应。
const EVENTS =
  'tap|change|input|confirm|action|select|delete|save|close|longpress|scrolltolower|error|load|submit|chooseavatar'

function checkHandlers(wxmlPath, jsPath, label) {
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) return
  const wxml = fs.readFileSync(wxmlPath, 'utf8')
  const js = fs.readFileSync(jsPath, 'utf8')
  const re = new RegExp('(?:bind|catch)(?:' + EVENTS + ')="([A-Za-z_$][\\w$]*)"', 'g')
  let m
  while ((m = re.exec(wxml))) {
    const h = m[1]
    const defined = new RegExp('(^|[\\s,{])' + h + '\\s*[:(]', 'm').test(js)
    if (!defined) errs.push(`${label} 缺少处理函数 ${h}`)
  }
}

for (const page of appJson.pages) {
  checkHandlers(path.join(root, page + '.wxml'), path.join(root, page + '.js'), page + '.js')
}
const compRoot2 = path.join(root, 'components')
if (fs.existsSync(compRoot2)) {
  for (const name of fs.readdirSync(compRoot2)) {
    const dir = path.join(compRoot2, name)
    if (!fs.statSync(dir).isDirectory()) continue
    checkHandlers(
      path.join(dir, 'index.wxml'),
      path.join(dir, 'index.js'),
      'components/' + name + '/index.js'
    )
  }
}

// 5. 组件对外事件
function componentsOf(pageDir) {
  const jsonPath = path.join(root, pageDir, 'index.json')
  if (!fs.existsSync(jsonPath)) return {}
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const map = {}
  for (const [tag, rel] of Object.entries(j.usingComponents || {})) {
    map[tag] = path.resolve(path.dirname(jsonPath), rel)
  }
  return map
}

function emitsOf(compDir) {
  const js = fs.readFileSync(path.join(compDir, 'index.js'), 'utf8')
  const set = new Set()
  const re = /triggerEvent\(\s*'([^']+)'/g
  let m
  while ((m = re.exec(js))) set.add(m[1])
  return set
}

for (const page of appJson.pages) {
  const wxml = fs.readFileSync(path.join(root, page + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(root, page + '.js'), 'utf8')
  const comps = componentsOf(page)
  const tagRe = /<([a-zA-Z][\w-]*)([^>]*?)\/?>/g
  let tm
  while ((tm = tagRe.exec(wxml))) {
    const tag = tm[1]
    if (!comps[tag]) continue
    const emits = emitsOf(comps[tag])
    const bindRe = /(?:bind|catch):?([a-zA-Z][\w-]*)\s*=\s*"([^"]+)"/g
    let bm
    while ((bm = bindRe.exec(tm[2]))) {
      const eventName = bm[1]
      const handler = bm[2]
      if (!emits.has(eventName)) {
        errs.push(`${page}.wxml: <${tag}> 监听 "${eventName}"，但组件没有 triggerEvent 该事件`)
      }
      const defined = new RegExp('(^|[\\s,{])' + handler + '\\s*[:(]', 'm').test(js)
      if (!defined) errs.push(`${page}.js 缺少处理函数 ${handler}（来自 <${tag}> 的 ${eventName}）`)
    }
  }
}

// 6. 跳转目标
const valid = new Set(appJson.pages)
for (const page of appJson.pages) {
  const js = fs.readFileSync(path.join(root, page + '.js'), 'utf8')
  const re = /url:\s*'(\/pages\/[^']+)'/g
  let m
  while ((m = re.exec(js))) {
    const target = m[1].split('?')[0].replace(/^\//, '')
    if (!valid.has(target)) errs.push(`${page}.js 跳转到未注册页面 ${target}`)
  }
}

// 7. 组件样式必须自己 import 主题变量
// 小程序自定义组件默认样式隔离，app.wxss 的规则匹配不到组件内部节点，
// 组件里的 var(--surface) 会取不到值 → 背景变透明、文字看不清。
const compRoot = path.join(root, 'components')
if (fs.existsSync(compRoot)) {
  for (const name of fs.readdirSync(compRoot)) {
    const wxss = path.join(compRoot, name, 'index.wxss')
    if (!fs.existsSync(wxss)) continue
    const src = fs.readFileSync(wxss, 'utf8')
    if (!/@import\s+"[^"]*styles\/theme\.wxss"/.test(src)) {
      errs.push(`components/${name}/index.wxss 没有 @import styles/theme.wxss（组件会拿不到主题变量）`)
    }
    // 用到公共类名的组件必须 import common.wxss
    // 按 class token 精确匹配，避免 "hbar-empty" / "tile-value-row" 这类误报
    const SHARED = new Set([
      'btn', 'btn-primary', 'btn-ghost', 'btn-outline', 'btn-disabled', 'btn-sm',
      'card', 'card-tight', 'row', 'row-between', 'col', 'grow',
      'section-title', 'section-sub', 'muted', 'secondary', 'tnum', 'divider',
      'pill', 'pill-active', 'swatch', 'empty', 'empty-icon', 'empty-title', 'empty-sub'
    ])
    const wxml = fs.readFileSync(path.join(compRoot, name, 'index.wxml'), 'utf8')
    const classRe = /class="([^"]*)"/g
    let cm
    const used = new Set()
    while ((cm = classRe.exec(wxml))) {
      cm[1]
        .split(/\s+/)
        .forEach((tok) => {
          if (tok && !tok.includes('{{')) used.add(tok)
        })
    }
    const sharedUsed = [...used].filter((t) => SHARED.has(t))
    // 组件自己定义过的类不需要从 common 引入
    const locallyDefined = (tok) => new RegExp('(^|[\\s,}])\\.' + tok + '\\s*[,{]', 'm').test(src)
    const unresolved = sharedUsed.filter((t) => !locallyDefined(t))
    if (unresolved.length && !/@import\s+"[^"]*styles\/common\.wxss"/.test(src)) {
      errs.push(
        `components/${name}/index.wxss 用到了公共类名 [${unresolved.join(', ')}] 但没有 @import styles/common.wxss`
      )
    }
  }
}

// 8. 页面样式不得再重复定义主题变量（应统一放在 styles/theme.wxss）
const appWxss = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8')
if (/^\.theme-(light|dark)\s*\{/m.test(appWxss)) {
  errs.push('app.wxss 里重复定义了 .theme-light/.theme-dark，应统一 @import styles/theme.wxss')
}

// 9. 弹层组件必须有提交按钮，且提交区不参与滚动
if (fs.existsSync(compRoot)) {
  for (const name of fs.readdirSync(compRoot)) {
    const wxmlPath = path.join(compRoot, name, 'index.wxml')
    if (!fs.existsSync(wxmlPath)) continue
    const wxml = fs.readFileSync(wxmlPath, 'utf8')
    if (!/class="footer"/.test(wxml)) continue
    if (!/btn-primary/.test(wxml)) {
      errs.push(`components/${name}/index.wxml 有提交区但没有主按钮（btn-primary）`)
    }
    const wxss = fs.readFileSync(path.join(compRoot, name, 'index.wxss'), 'utf8')
    // 提交区必须 flex:none，否则会被滚动内容顶出屏幕
    const footerRule = wxss.match(/\.footer\s*\{[^}]*\}/)
    if (!footerRule || !/flex:\s*none/.test(footerRule[0])) {
      errs.push(`components/${name}/index.wxss 的 .footer 需要 flex:none（提交按钮不能被滚动内容顶出屏幕）`)
    }
  }
}

// 7. WXML 标签是否闭合
const SELF_CLOSING = new Set(['image', 'input', 'icon', 'import', 'include', 'wxs'])
function collectWxml(dir, out) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (!fs.statSync(p).isDirectory()) continue
    if (fs.existsSync(path.join(p, 'index.wxml'))) out.push(p)
    else collectWxml(p, out)
  }
  return out
}
const wxmlDirs = [
  ...collectWxml('pages', []),
  ...collectWxml('components', []),
  'custom-tab-bar'
]
for (const dir of wxmlDirs) {
  const file = path.join(root, dir, 'index.wxml')
  if (!fs.existsSync(file)) continue
  const body = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const stack = []
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g
  let m
  let broken = false
  while ((m = re.exec(body))) {
    const closing = m[1] === '/'
    const tag = m[2]
    if (SELF_CLOSING.has(tag) || m[4] === '/') continue
    if (closing) {
      const top = stack.pop()
      if (top !== tag) {
        errs.push(`${dir}/index.wxml 标签不匹配：</${tag}> 对上了 <${top || '无'}>`)
        broken = true
        break
      }
    } else {
      stack.push(tag)
    }
  }
  if (!broken && stack.length) {
    errs.push(`${dir}/index.wxml 有未闭合标签：${stack.join(', ')}`)
  }
}

// 9. 用了 theme-{{theme}} 的组件必须真的声明 theme 属性
// 少声明一个属性，类名就渲染成 theme-，组件里所有 var(--…) 全部取不到值——
// 表现是「整个组件透明、定位失效」，但不报任何错。
function checkThemeProperty(dir) {
  const wxmlPath = path.join(root, dir, 'index.wxml')
  const jsPath = path.join(root, dir, 'index.js')
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) return
  const wxml = fs.readFileSync(wxmlPath, 'utf8')
  if (wxml.indexOf('theme-{{theme}}') === -1) return
  const js = fs.readFileSync(jsPath, 'utf8')
  const hasProperty = /properties\s*:[\s\S]{0,400}?\btheme\s*:/.test(js)
  const hasData = /data\s*:[\s\S]{0,400}?\btheme\s*:/.test(js)
  if (!hasProperty && !hasData) {
    errs.push(`${dir} 的 wxml 用了 theme-{{theme}}，但 js 里没有 theme 属性/字段`)
  }
}
for (const page of appJson.pages) checkThemeProperty(page)
if (fs.existsSync(compRoot)) {
  for (const name of fs.readdirSync(compRoot)) {
    const dir = path.join(compRoot, name)
    if (fs.statSync(dir).isDirectory()) checkThemeProperty(dir)
  }
}
if (fs.existsSync(path.join(root, 'custom-tab-bar'))) checkThemeProperty('custom-tab-bar')

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ALL CHECKS PASS')
if (errs.length) process.exitCode = 1

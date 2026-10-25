/**
 * 前端规范检查：
 *   1. WXML 里用到的 class 都要有定义（页面自身 wxss 或 styles/ 公共类）
 *   2. 页面/组件样式里不该出现写死的颜色（应走 theme.wxss 的 CSS 变量）
 *
 * 第 2 条是「更符合前端开发规范」的关键：颜色散落在几十个 wxss 里，
 * 换肤时必然漏改；集中到 tokens 才能一键切主题。
 *
 * 运行：node test/style.test.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
process.chdir(root)

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

function readClassNames(file) {
  if (!fs.existsSync(file)) return new Set()
  const src = fs.readFileSync(file, 'utf8')
  const names = new Set()
  const re = /\.([a-zA-Z][\w-]*)/g
  let m
  while ((m = re.exec(src))) names.add(m[1])
  return names
}

const shared = new Set([
  ...readClassNames('styles/common.wxss'),
  ...readClassNames('styles/theme.wxss'),
  ...readClassNames('app.wxss')
])

// 每个目录里含 index.wxml 的都算一个页面/组件
function collect(dir, out) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (!fs.statSync(p).isDirectory()) continue
    if (fs.existsSync(path.join(p, 'index.wxml'))) out.push(p)
    else collect(p, out)
  }
  return out
}

const units = [
  ...collect('pages', []),
  ...collect('components', []),
  ...(fs.existsSync('custom-tab-bar') ? ['custom-tab-bar'] : [])
]

console.log('\n样式规范')

check('WXML 里用到的 class 都有定义', () => {
  const missing = []
  units.forEach((dir) => {
    const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8')
    const own = readClassNames(path.join(dir, 'index.wxss'))
    const used = new Set()
    const re = /class="([^"]*)"/g
    let m
    while ((m = re.exec(wxml))) {
      m[1]
        .replace(/\{[\s\S]*?\}/g, ' ')
        .split(/\s+/)
        .forEach((tok) => {
          if (!tok) return
          // 动态前缀（如 theme-{{theme}} 去掉表达式后剩下的 theme-）不是类名
          if (tok.endsWith('-')) return
          if (/^[a-zA-Z][\w-]*$/.test(tok)) used.add(tok)
        })
    }
    used.forEach((c) => {
      if (!own.has(c) && !shared.has(c)) missing.push(dir + ' -> .' + c)
    })
  })
  assert_empty(missing)
})

/** 颜色白名单：只允许主题文件、常量文件里出现字面色值 */
const COLOR_WHITELIST = new Set([
  path.join('styles', 'theme.wxss'),
  path.join('styles', 'common.wxss'),
  path.join('app.wxss'),
  path.join('utils', 'constants.js')
])

check('页面/组件样式里没有写死的颜色（应走 theme.wxss 变量）', () => {
  const offenders = []
  units.forEach((dir) => {
    const wxssPath = path.join(dir, 'index.wxss')
    if (!fs.existsSync(wxssPath)) return
    if (COLOR_WHITELIST.has(path.normalize(wxssPath))) return
    const src = fs.readFileSync(wxssPath, 'utf8')
    // 去掉注释后再找色值
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g
    const hits = body.match(re) || []
    if (hits.length) offenders.push(dir + ' -> ' + hits.slice(0, 4).join(', '))
  })
  assert_empty(offenders)
})

function assert_empty(list) {
  if (list.length) {
    throw new Error(list.slice(0, 12).join('\n      '))
  }
}

console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')

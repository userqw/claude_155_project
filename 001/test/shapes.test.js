/**
 * 品类管理验收测试（PRD §5.4.1）
 *
 * 运行：node test/shapes.test.js
 *
 * 盯的是自定义品类的增删改查，以及内置四个品类「可改名、可排序、不可删」
 * 这条边界（CLAUDE.md 的领域规则 6）。
 */
const assert = require('assert')
const path = require('path')

// -- 微信 API mock ----------------------------------------------------------
const store = {}
let toastText = ''
let modalResult = { confirm: true, content: '' }
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v },
  removeStorageSync: (k) => { delete store[k] },
  getStorageInfoSync: () => ({ keys: Object.keys(store) }),
  showToast: (o) => { toastText = o.title },
  showModal: (o) => { if (o.success) o.success(modalResult) },
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2 })
}

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const db = require(path.join(root, 'utils/db.js'))
db.init()

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log('  ✓ ' + name)
  } catch (e) {
    failed += 1
    console.log('  ✗ ' + name + '\n      ' + e.message)
    process.exitCode = 1
  }
}

// -- 加载品类管理页 ----------------------------------------------------------
let pageDef = null
global.Page = (def) => { pageDef = def }
global.getApp = () => ({ globalData: { theme: 'light' } })
require(path.join(root, 'pages/mine/shapes/index.js'))

function makePage() {
  const inst = Object.assign({}, pageDef, { data: Object.assign({}, pageDef.data) })
  inst.setData = (patch) => {
    // 模拟 setData 支持 'a.b' 路径
    Object.keys(patch).forEach((k) => {
      if (k.indexOf('.') > -1) {
        const [a, b] = k.split('.')
        inst.data[a] = Object.assign({}, inst.data[a], { [b]: patch[k] })
      } else {
        inst.data[k] = patch[k]
      }
    })
  }
  return inst
}

/** 走一遍「新建品类」并保存 */
function createCategory(page, name, icon) {
  page.onAdd()
  page.setData({ 'form.name': name })
  if (icon) page.onIcon({ currentTarget: { dataset: { icon } } })
  page.onSave()
  return db.listShapes().find((s) => s.name === name)
}

async function main() {
  console.log('\n内置品类（默认四个，不做改动）')

  await check('默认四个内置品类都在，且都不能删', () => {
    const builtins = db.listShapes().filter((s) => s.isBuiltin)
    assert.strictEqual(builtins.length, 4)
    assert.deepStrictEqual(
      builtins.map((s) => s.name).sort(),
      ['OB11娃头', 'QQ人', '其他', '正比']
    )
  })

  await check('内置品类点删除不会真被删掉', () => {
    const before = db.listShapes().length
    const page = makePage()
    page.onDelete({ currentTarget: { dataset: { id: 'shape_ob11' } } })
    assert.strictEqual(db.listShapes().length, before, '内置品类不该被删')
    assert.ok(db.getShape('shape_ob11'), '内置品类应当还在')
  })

  console.log('\n增：新建自定义品类')

  await check('能新建一个自定义品类', () => {
    const page = makePage()
    const created = createCategory(page, '摆件', '🎁')
    assert.ok(created, '应当建出「摆件」')
    assert.strictEqual(created.isBuiltin, false, '自定义品类不是内置')
    assert.strictEqual(created.name, '摆件')
  })

  await check('自定义品类占用扩展色槽（4~7），不与内置的撞', () => {
    const custom = db.listShapes().find((s) => s.name === '摆件')
    assert.ok(custom.slot >= 4 && custom.slot <= 7, '色槽应当在 4~7，实际 ' + custom.slot)
    const builtinSlots = db.listShapes().filter((s) => s.isBuiltin).map((s) => s.slot)
    assert.strictEqual(builtinSlots.indexOf(custom.slot), -1, '色槽不能和内置的撞')
  })

  await check('自定义品类最多 4 个：第 5 个被拒绝，不循环色槽', () => {
    const page = makePage()
    createCategory(page, '摆件2', '🎁')
    createCategory(page, '摆件3', '🎁')
    createCategory(page, '摆件4', '🎁')
    const before = db.listShapes().length
    page.onAdd()
    assert.strictEqual(db.listShapes().length, before, '不该建出第 5 个自定义品类')
    assert.ok(toastText.indexOf('最多 4 个') > -1, '应当说明上限：' + toastText)
  })

  console.log('\n改：编辑品类')

  await check('能改自定义品类的名字', () => {
    const page = makePage()
    const custom = db.listShapes().find((s) => s.name === '摆件')
    page.onEdit({ currentTarget: { dataset: { id: custom.id } } })
    page.setData({ 'form.name': '小摆件' })
    page.onSave()
    assert.ok(db.getShape(custom.id), '品类不该消失')
    assert.strictEqual(db.getShape(custom.id).name, '小摆件')
  })

  await check('内置品类可以改名（PRD §5.4.1：可改名 / 换图标 / 调排序）', () => {
    const page = makePage()
    page.onEdit({ currentTarget: { dataset: { id: 'shape_qq' } } })
    page.setData({ 'form.name': 'QQ头' })
    page.onSave()
    assert.strictEqual(db.getShape('shape_qq').name, 'QQ头')
    // 改回去，别影响别的用例
    page.onEdit({ currentTarget: { dataset: { id: 'shape_qq' } } })
    page.setData({ 'form.name': 'QQ人' })
    page.onSave()
  })

  await check('没动图标时，内置品类默认的 svg 保留', () => {
    const page = makePage()
    page.onEdit({ currentTarget: { dataset: { id: 'shape_ob11' } } })
    page.setData({ 'form.name': 'OB11娃头' })
    page.onSave()
    assert.strictEqual(db.getShape('shape_ob11').iconPath, '/assets/icons/ob11.svg',
      '不该把默认图标弄丢')
  })

  await check('用户挑了新图标就以他的为准（默认的 svg 让位）', () => {
    const page = makePage()
    page.onEdit({ currentTarget: { dataset: { id: 'shape_ob11' } } })
    page.onIcon({ currentTarget: { dataset: { icon: '🐰' } } })
    page.onSave()
    assert.strictEqual(db.getShape('shape_ob11').icon, '🐰')
    assert.strictEqual(db.getShape('shape_ob11').iconPath, '', '挑了图标就不该再用默认 svg')
  })

  console.log('\n查：列表')

  await check('列表里能看到自定义品类', () => {
    const page = makePage()
    page.load()
    assert.ok(page.data.shapes.length > 4, '自定义品类应当出现在列表里')
    assert.ok(page.data.shapes.some((s) => s.name === '小摆件'))
  })

  await check('列表里没有重复的内置品类', () => {
    const page = makePage()
    page.load()
    const builtinNames = page.data.shapes.filter((s) => s.isBuiltin).map((s) => s.name)
    assert.strictEqual(new Set(builtinNames).size, builtinNames.length, '内置品类不该重复')
  })

  console.log('\n删：删除自定义品类')

  await check('删自定义品类时，历史记录迁移到「其他」', () => {
    const custom = db.listShapes().find((s) => s.name === '小摆件')
    db.addCheckIn({ date: '2026-06-01', shapeId: custom.id, count: 3 })
    assert.strictEqual(db.aliveCheckIns().filter((c) => c.shapeId === custom.id).length, 1)

    const page = makePage()
    page.onDelete({ currentTarget: { dataset: { id: custom.id } } })
    assert.ok(!db.getShape(custom.id), '品类应当被删掉')
    const moved = db.aliveCheckIns().filter((c) => c.shapeId === 'shape_other')
    assert.strictEqual(moved.length, 1, '历史记录应当迁到「其他」')
    assert.strictEqual(moved[0].count, 3, '数量不该变')
  })

  await check('删除后列表同步更新', () => {
    const page = makePage()
    page.load()
    assert.strictEqual(page.data.shapes.some((s) => s.name === '小摆件'), false)
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main()

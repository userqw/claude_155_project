/**
 * 素材库验收测试（对照 PRD §12 的 AC-13 ~ AC-15）
 * 运行：node test/material.test.js
 */
const assert = require('assert')
const path = require('path')

// -- 微信 API mock ----------------------------------------------------------
const store = {}
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => {
    store[k] = v
  },
  removeStorageSync: (k) => {
    delete store[k]
  },
  getStorageInfoSync: () => ({ keys: Object.keys(store) }),
  showToast: () => {},
  showModal: () => {},
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2 })
}

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const db = require(path.join(root, 'utils/db.js'))

db.init()

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

console.log('\nAC-13 素材库文件夹')

check('新建文件夹后出现在列表里，计数为 0', () => {
  const f = db.addFolder('配色参考')
  assert.strictEqual(db.listFolders().length, 1)
  assert.strictEqual(db.listFolders()[0].name, '配色参考')
  assert.strictEqual(db.materialCounts().counts[f.id] || 0, 0)
})

const folder = db.listFolders()[0]

check('往文件夹添加 3 张素材后计数为 3', () => {
  db.addMaterials(folder.id, [
    { url: 'a.jpg', name: '素材 1' },
    { url: 'b.jpg', name: '素材 2' },
    { url: 'c.jpg', name: '素材 3' }
  ])
  assert.strictEqual(db.materialCounts().counts[folder.id], 3)
  assert.strictEqual(db.listMaterials({ folderId: folder.id }).length, 3)
})

check('文件夹封面取第一张素材', () => {
  const list = db.listMaterials({ folderId: folder.id })
  assert.strictEqual(list[0].url, 'c.jpg', '封面应为最新一张或第一张，取决于排序口径')
})

check('删除文件夹不删素材：素材全部转到未分类', () => {
  db.removeFolder(folder.id)
  assert.strictEqual(db.listFolders().length, 0, '文件夹应被删除')
  assert.strictEqual(db.listMaterials({ folderId: '' }).length, 3, '3 张素材一张都不能少')
  assert.strictEqual(db.materialCounts().unfiled, 3)
  assert.strictEqual(db.materialCounts().total, 3)
})

console.log('\nAC-14 素材增删改查')

check('素材改名生效', () => {
  const m = db.listMaterials({})[0]
  db.updateMaterial(m.id, { name: '暖橘色' })
  assert.strictEqual(db.getMaterial(m.id).name, '暖橘色')
})

check('移动素材：目标计数 +1、原计数 −1，素材不重复', () => {
  const target = db.addFolder('工具')
  const m = db.listMaterials({ folderId: '' })[0]
  db.updateMaterial(m.id, { folderId: target.id })
  assert.strictEqual(db.materialCounts().counts[target.id], 1)
  assert.strictEqual(db.materialCounts().unfiled, 2)
  assert.strictEqual(db.materialCounts().total, 3, '总数不变，素材不能被复制')
})

check('删除素材是软删除：从列表消失但可恢复', () => {
  const m = db.listMaterials({})[0]
  db.removeMaterial(m.id)
  assert.strictEqual(db.listMaterials({}).length, 2, '应从列表消失')
  assert.strictEqual(db.listMaterialTrash().length, 1)
  assert.ok(db.getMaterial(m.id), '记录本身还在，只是标记删除')
  db.restoreMaterial(m.id)
  assert.strictEqual(db.listMaterials({}).length, 3)
})

check('删除的素材不计入统计', () => {
  const m = db.listMaterials({})[0]
  db.removeMaterial(m.id)
  assert.strictEqual(db.materialCounts().total, 2)
  db.restoreMaterial(m.id)
  assert.strictEqual(db.materialCounts().total, 3)
})

console.log('\nAC-15 素材搜索')

check('按名称搜索能过滤', () => {
  const m = db.listMaterials({})[0]
  db.updateMaterial(m.id, { name: '暖橘色', note: '三文鱼牌子的橙' })
  const hit = db.listMaterials({ keyword: '橘' })
  assert.strictEqual(hit.length, 1)
  assert.strictEqual(hit[0].id, m.id)
})

check('备注也参与搜索', () => {
  const hit = db.listMaterials({ keyword: '三文鱼' })
  assert.strictEqual(hit.length, 1)
})

check('清空关键词恢复全部', () => {
  assert.strictEqual(db.listMaterials({ keyword: '' }).length, 3)
  assert.strictEqual(db.listMaterials({ keyword: '不存在的词' }).length, 0)
})

console.log('\n素材库是私有内容（未登录看不到）')

const auth = require(path.join(root, 'utils/auth.js'))
auth.init()

let pageDef = null
global.Page = (def) => { pageDef = def }
global.getApp = () => ({ globalData: { theme: 'light' } })
require(path.join(root, 'pages/material/index.js'))

function makeMaterialPage() {
  const inst = Object.assign({}, pageDef, { data: Object.assign({}, pageDef.data) })
  inst.setData = (patch) => Object.assign(inst.data, patch)
  return inst
}

check('未登录时素材库是空的：文件夹、素材、数量都不露', () => {
  auth.logout()
  const page = makeMaterialPage()
  page.load()
  assert.strictEqual(page.data.locked, true, '应当处于「私有」状态')
  assert.strictEqual(page.data.folders.length, 0, '文件夹不该露出来')
  assert.strictEqual(page.data.materials.length, 0, '素材不该露出来')
  assert.strictEqual(page.data.counts.total, 0, '数量不该露出来')
})

check('未登录时不能新增素材或文件夹（不然加了却看不见）', () => {
  auth.logout()
  const page = makeMaterialPage()
  page.load()
  const foldersBefore = db.listFolders().length
  const materialsBefore = db.listMaterials({}).length
  page.onCreateFolder()
  page.onAddMaterial()
  assert.strictEqual(db.listFolders().length, foldersBefore, '不该建出文件夹')
  assert.strictEqual(db.listMaterials({}).length, materialsBefore, '不该加出素材')
})

check('登录后素材库内容照常可见', () => {
  auth.devLogin()
  const page = makeMaterialPage()
  page.load()
  assert.strictEqual(page.data.locked, false)
  assert.ok(page.data.counts.total > 0, '登录后应能看到素材数量')
  assert.ok(page.data.folders.length > 0, '登录后应能看到文件夹')
})

check('退出登录后素材库重新变空（退出不删数据，只是藏起来）', () => {
  auth.logout()
  const page = makeMaterialPage()
  page.load()
  assert.strictEqual(page.data.locked, true)
  assert.strictEqual(db.listMaterials({}).length, 3, '本机数据一条不少')
})

console.log('\n清理')

check('注销账号时素材与文件夹一并清空', () => {
  db.clearAll()
  assert.strictEqual(db.listMaterials({}).length, 0)
  assert.strictEqual(db.listFolders().length, 0)
  assert.strictEqual(db.materialCounts().total, 0)
})

check('清空后内置分类不受影响', () => {
  assert.strictEqual(db.listShapes().length, 4)
  assert.strictEqual(db.listTags().length, 6)
})

console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')

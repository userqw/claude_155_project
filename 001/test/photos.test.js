/**
 * 图片持久化验收测试
 *
 * 运行：node test/photos.test.js
 *
 * 盯的是「选完照片没反应」这类静默故障：
 * saveToLocal 一旦抛异常，上游的 Promise.all 一起挂掉，
 * 选照片的回调永远不 resolve——界面表现是点了没反应，比报错更难查。
 */
const assert = require('assert')
const path = require('path')

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

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))

// 故意不给 wx.env：低版本基础库上它不存在，
// 读 USER_DATA_PATH 会抛「undefined is not an object」
const store = {}
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v },
  removeStorageSync: (k) => { delete store[k] },
  getSystemInfoSync: () => ({ theme: 'light', pixelRatio: 2 }),
  getFileSystemManager: () => ({
    saveFile: (o) => o.success({ savedFilePath: 'wxfile://store/saved.jpg' })
  }),
  chooseMedia: (o) => o.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp_a.jpg' }] }),
  chooseImage: (o) => o.success({ tempFilePaths: ['wxfile://tmp_a.jpg'] })
}

const photos = require(path.join(root, 'utils/photos.js'))

async function main() {
  console.log('\n图片持久化')

  await check('wx.env 不存在时也不抛异常（这是真机上崩过的那个坑）', async () => {
    assert.strictEqual(typeof wx.env, 'undefined', '测试前提：wx.env 应当不存在')
    const res = await photos.saveToLocal('wxfile://tmp_a.jpg')
    assert.ok(res, '应当 resolve 一个对象')
    assert.ok(res.url, '应当有 url')
  })

  await check('不依赖 wx.env.USER_DATA_PATH（低版本基础库上根本没有）', () => {
    const src = require('fs').readFileSync(path.join(root, 'utils/photos.js'), 'utf8')
    // 只看代码，注释里可以写这个名字
    const code = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
    assert.strictEqual(code.indexOf('USER_DATA_PATH'), -1,
      'photos.js 的代码里不该再出现 USER_DATA_PATH')
  })

  await check('存盘成功时返回微信给的持久路径', async () => {
    const res = await photos.saveToLocal('wxfile://tmp_a.jpg')
    assert.strictEqual(res.url, 'wxfile://store/saved.jpg')
  })

  await check('saveFile 抛异常时退回临时路径，不 reject', async () => {
    global.wx.getFileSystemManager = () => ({
      saveFile: () => { throw new Error('boom') }
    })
    const res = await photos.saveToLocal('wxfile://tmp_a.jpg')
    assert.strictEqual(res.url, 'wxfile://tmp_a.jpg')
    global.wx.getFileSystemManager = () => ({
      saveFile: (o) => o.success({ savedFilePath: 'wxfile://store/saved.jpg' })
    })
  })

  await check('getFileSystemManager 不存在时也不炸', async () => {
    const saved = global.wx.getFileSystemManager
    global.wx.getFileSystemManager = undefined
    const res = await photos.saveToLocal('wxfile://tmp_a.jpg')
    assert.strictEqual(res.url, 'wxfile://tmp_a.jpg')
    global.wx.getFileSystemManager = saved
  })

  await check('选照片的回调一定会回来（不会静默卡住）', async () => {
    const list = await photos.pickImages(1, 'album')
    assert.ok(Array.isArray(list))
    assert.strictEqual(list.length, 1)
    assert.ok(list[0])
  })

  console.log('\n' + (failed ? failed + ' 个用例失败' : passed + ' 个用例全部通过') + '\n')
}

main()

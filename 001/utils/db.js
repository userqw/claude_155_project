/**
 * 本地优先数据层。
 *
 * - 所有写操作先落本地 Storage（wx.setStorageSync），成功后才尝试云端同步。
 *   断网时打卡、售出、编辑全部可用，恢复网络后由 utils/cloud.js 消费 pending 队列。
 * - 删除为软删除（deletedAt 打时间戳），回收站保留 30 天，见 PRD §5.1.3。
 * - 每天首次写入时自动做一份 JSON 快照，保留最近 7 份，见 PRD §8.2。
 */

const {
  BUILTIN_SHAPES,
  BUILTIN_TAGS,
  TRASH_KEEP_DAYS,
  BACKUP_KEEP
} = require('./constants')
const { today, addDays, daysInMonth } = require('./date')

const STORAGE_KEY = 'nt_db_v1'
const BACKUP_PREFIX = 'nt_backup_'

let state = null
let listeners = []

// -- 生命周期 ---------------------------------------------------------------

function seed() {
  return {
    version: 1,
    checkIns: [],
    photos: [],
    sales: [],
    folders: [],
    materials: [],
    shapes: BUILTIN_SHAPES.map((s) => Object.assign({}, s)),
    tags: BUILTIN_TAGS.map((t) => Object.assign({}, t)),
    pending: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function init() {
  if (state) return state
  let loaded = null
  try {
    loaded = wx.getStorageSync(STORAGE_KEY)
  } catch (e) {
    loaded = null
  }
  state = loaded && loaded.version ? loaded : seed()
  // 补齐内置分类（版本升级时新增的内置项）
  BUILTIN_SHAPES.forEach((b) => {
    if (!state.shapes.some((s) => s.id === b.id)) {
      state.shapes.push(Object.assign({}, b))
      return
    }
    // 回填图标资源：老设备上存的分类是加 iconPath 之前写入的，
    // 只补图标，不动用户改过的名字和 emoji
    const stored = state.shapes.find((s) => s.id === b.id)
    if (b.iconPath && stored.iconPath !== b.iconPath) {
      stored.iconPath = b.iconPath
    }
  })
  BUILTIN_TAGS.forEach((b) => {
    if (!state.tags.some((t) => t.id === b.id)) state.tags.push(Object.assign({}, b))
  })
  state.shapes.sort((a, b) => (a.sort || 0) - (b.sort || 0))
  return state
}

function getState() {
  if (!state) init()
  return state
}

function subscribe(fn) {
  listeners.push(fn)
  return function unsubscribe() {
    const i = listeners.indexOf(fn)
    if (i > -1) listeners.splice(i, 1)
  }
}

function emit(type, payload) {
  listeners.slice().forEach((fn) => {
    try {
      fn(type, payload)
    } catch (e) {
      console.error('[db] listener error', e)
    }
  })
}

// -- 持久化 -----------------------------------------------------------------

function persist() {
  state.updatedAt = Date.now()
  try {
    wx.setStorageSync(STORAGE_KEY, state)
  } catch (e) {
    console.error('[db] 写入本地存储失败', e)
    wx.showToast({ title: '本地存储写入失败', icon: 'none' })
  }
  dailyBackup()
}

function commit(type, payload, mutator) {
  init()
  const result = mutator ? mutator(state) : undefined
  persist()
  emit(type, payload)
  return result
}

function dailyBackup() {
  const d = today()
  const key = BACKUP_PREFIX + d
  try {
    if (wx.getStorageSync(key)) return
    wx.setStorageSync(
      key,
      JSON.stringify({
        at: Date.now(),
        checkIns: state.checkIns,
        sales: state.sales,
        shapes: state.shapes,
        tags: state.tags
      })
    )
    // 只保留最近 BACKUP_KEEP 份
    const info = wx.getStorageInfoSync()
    const keys = (info.keys || []).filter((k) => k.indexOf(BACKUP_PREFIX) === 0)
    keys.sort()
    while (keys.length > BACKUP_KEEP) {
      const old = keys.shift()
      wx.removeStorageSync(old)
    }
  } catch (e) {
    console.error('[db] 备份失败', e)
  }
}

// -- id ---------------------------------------------------------------------

let seq = 0
function uid(prefix) {
  seq += 1
  return prefix + '_' + Date.now().toString(36) + '_' + seq.toString(36)
}

// -- 造型 -------------------------------------------------------------------

function listShapes() {
  return getState().shapes.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
}

function getShape(id) {
  return getState().shapes.find((s) => s.id === id) || null
}

function saveShape(shape) {
  return commit('shapes', shape, () => {
    const list = state.shapes
    const idx = list.findIndex((s) => s.id === shape.id)
    if (idx > -1) {
      list[idx] = Object.assign({}, list[idx], shape, { id: list[idx].id })
      return list[idx]
    }
    const item = Object.assign(
      {
        id: uid('shape'),
        name: '新品类',
        icon: '🎨',
        slot: state.shapes.length % 8,
        isBuiltin: false,
        sort: state.shapes.length
      },
      shape
    )
    list.push(item)
    return item
  })
}

function removeShape(id, migrateTo) {
  const target = migrateTo || 'shape_other'
  return commit('shapes', { id }, () => {
    const shape = state.shapes.find((s) => s.id === id)
    if (!shape || shape.isBuiltin) return false
    // 历史记录迁移到目标分类（PRD §5.4.1）
    state.checkIns.forEach((c) => {
      if (c.shapeId === id) c.shapeId = target
    })
    state.shapes = state.shapes.filter((s) => s.id !== id)
    return true
  })
}

function reorderShapes(ids) {
  return commit('shapes', ids, () => {
    ids.forEach((id, i) => {
      const s = state.shapes.find((x) => x.id === id)
      if (s) s.sort = i
    })
  })
}

// -- 标签 -------------------------------------------------------------------

function listTags() {
  return getState().tags.slice()
}

function saveTag(tag) {
  return commit('tags', tag, () => {
    const list = state.tags
    const idx = list.findIndex((t) => t.id === tag.id)
    if (idx > -1) {
      list[idx] = Object.assign({}, list[idx], tag)
      return list[idx]
    }
    const item = Object.assign(
      { id: uid('tag'), name: '新标签', color: '#898781', isBuiltin: false },
      tag
    )
    list.push(item)
    return item
  })
}

function removeTag(id) {
  return commit('tags', { id }, () => {
    const tag = state.tags.find((t) => t.id === id)
    if (!tag || tag.isBuiltin) return false
    state.tags = state.tags.filter((t) => t.id !== id)
    state.checkIns.forEach((c) => {
      c.tagIds = (c.tagIds || []).filter((t) => t !== id)
    })
    return true
  })
}

// -- 打卡记录 ---------------------------------------------------------------

function aliveCheckIns() {
  return getState().checkIns.filter((c) => !c.deletedAt)
}

function listCheckIns(filter) {
  const f = filter || {}
  let list = aliveCheckIns()
  if (f.year) list = list.filter((c) => String(c.date).slice(0, 4) === String(f.year))
  if (f.shapeId) list = list.filter((c) => c.shapeId === f.shapeId)
  if (f.tagId) list = list.filter((c) => (c.tagIds || []).indexOf(f.tagId) > -1)
  if (f.date) list = list.filter((c) => c.date === f.date)
  if (f.saleState === 'sold' || f.saleState === 'unsold') {
    const soldMap = soldCountByCheckIn()
    list = list.filter((c) => {
      const sold = soldMap[c.id] || 0
      return f.saleState === 'sold' ? sold > 0 : sold < c.count
    })
  }
  const sorted = list.slice().sort((a, b) => {
    if (a.date === b.date) return (b.createdAt || 0) - (a.createdAt || 0)
    return a.date < b.date ? 1 : -1
  })
  return f.asc ? sorted.reverse() : sorted
}

function getCheckIn(id) {
  return getState().checkIns.find((c) => c.id === id) || null
}

function addCheckIn(payload) {
  return commit('checkIns', payload, () => {
    const item = Object.assign(
      {
        id: uid('ci'),
        date: today(),
        shapeId: 'shape_other',
        count: 1,
        note: '',
        tagIds: [],
        durationMin: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null
      },
      payload
    )
    item.createdAt = Date.now()
    item.updatedAt = Date.now()
    state.checkIns.push(item)
    return item
  })
}

function updateCheckIn(id, patch) {
  return commit('checkIns', { id }, () => {
    const c = state.checkIns.find((x) => x.id === id)
    if (!c) return null
    Object.assign(c, patch, { id: c.id, updatedAt: Date.now() })
    // 数量下调后若已售出数量超过产量，给出提示但不静默改写历史
    return c
  })
}

function softDeleteCheckIn(id) {
  return commit('checkIns', { id }, () => {
    const c = state.checkIns.find((x) => x.id === id)
    if (!c) return false
    c.deletedAt = Date.now()
    c.updatedAt = Date.now()
    return true
  })
}

function restoreCheckIn(id) {
  return commit('checkIns', { id }, () => {
    const c = state.checkIns.find((x) => x.id === id)
    if (!c) return false
    c.deletedAt = null
    c.updatedAt = Date.now()
    return true
  })
}

function listTrash() {
  const cutoff = Date.now() - TRASH_KEEP_DAYS * 86400000
  return getState()
    .checkIns.filter((c) => c.deletedAt && c.deletedAt > cutoff)
    .sort((a, b) => b.deletedAt - a.deletedAt)
}

function purgeTrash() {
  return commit('checkIns', null, () => {
    const cutoff = Date.now() - TRASH_KEEP_DAYS * 86400000
    const removed = state.checkIns.filter((c) => c.deletedAt && c.deletedAt <= cutoff)
    state.checkIns = state.checkIns.filter((c) => !(c.deletedAt && c.deletedAt <= cutoff))
    const ids = removed.map((c) => c.id)
    state.photos = state.photos.filter((p) => ids.indexOf(p.checkInId) === -1)
    state.sales = state.sales.filter((s) => ids.indexOf(s.checkInId) === -1)
    // 素材的软删除记录同样按 30 天清理
    state.materials = state.materials.filter((m) => !(m.deletedAt && m.deletedAt <= cutoff))
    return removed.length
  })
}

// -- 照片 -------------------------------------------------------------------

function listPhotos(checkInId) {
  return getState()
    .photos.filter((p) => p.checkInId === checkInId)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
}

function addPhotos(checkInId, paths) {
  return commit('photos', { checkInId }, () => {
    const existing = state.photos.filter((p) => p.checkInId === checkInId)
    const added = paths.map((p, i) => ({
      id: uid('ph'),
      checkInId: checkInId,
      url: p.url,
      localPath: p.localPath || '',
      width: p.width || 0,
      height: p.height || 0,
      sort: existing.length + i
    }))
    state.photos.push.apply(state.photos, added)
    return added
  })
}

function removePhoto(photoId) {
  return commit('photos', { photoId }, () => {
    const photo = state.photos.find((p) => p.id === photoId)
    state.photos = state.photos.filter((p) => p.id !== photoId)
    // 若删的是封面，封面顺延到下一张
    const rest = state.photos.filter((p) => p.checkInId === (photo && photo.checkInId))
    rest.forEach((p, i) => {
      p.sort = i
    })
    return true
  })
}

function setCover(checkInId, photoId) {
  return commit('photos', { checkInId, photoId }, () => {
    const list = state.photos.filter((p) => p.checkInId === checkInId)
    list.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    list.forEach((p, i) => {
      p.sort = p.id === photoId ? 0 : i + 1
    })
    return true
  })
}

// -- 售出 -------------------------------------------------------------------

function listSales(filter) {
  const f = filter || {}
  let list = getState().sales.filter((s) => !s.deletedAt)
  if (f.checkInId) list = list.filter((s) => s.checkInId === f.checkInId)
  if (f.year) list = list.filter((s) => String(s.soldDate).slice(0, 4) === String(f.year))
  return list.sort((a, b) => (a.soldDate < b.soldDate ? 1 : a.soldDate > b.soldDate ? -1 : b.createdAt - a.createdAt))
}

function soldCountByCheckIn() {
  const map = {}
  getState()
    .sales.filter((s) => !s.deletedAt)
    .forEach((s) => {
      map[s.checkInId] = (map[s.checkInId] || 0) + s.quantity
    })
  return map
}

function addSale(payload) {
  return commit('sales', payload, () => {
    const quantity = Math.max(1, Number(payload.quantity) || 1)
    const unitPrice = Math.max(0, Number(payload.unitPrice) || 0)
    const item = Object.assign(
      {
        id: uid('sale'),
        checkInId: '',
        quantity: 1,
        unitPrice: 0,
        soldDate: today(),
        channel: 'other',
        note: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null
      },
      payload
    )
    item.quantity = quantity
    item.unitPrice = unitPrice
    item.totalAmount = Math.round(quantity * unitPrice * 100) / 100
    state.sales.push(item)
    return item
  })
}

function updateSale(id, patch) {
  return commit('sales', { id }, () => {
    const s = state.sales.find((x) => x.id === id)
    if (!s) return null
    Object.assign(s, patch, { id: s.id, updatedAt: Date.now() })
    s.totalAmount = Math.round(s.quantity * s.unitPrice * 100) / 100
    return s
  })
}

function removeSale(id) {
  return commit('sales', { id }, () => {
    const s = state.sales.find((x) => x.id === id)
    if (!s) return false
    s.deletedAt = Date.now()
    s.updatedAt = Date.now()
    return true
  })
}

// -- 同步队列 ---------------------------------------------------------------

function enqueue(op) {
  return commit('pending', op, () => {
    state.pending.push(Object.assign({ id: uid('op'), at: Date.now() }, op))
    return true
  })
}

function pendingOps() {
  return getState().pending.slice()
}

function clearPending(ids) {
  return commit('pending', ids, () => {
    state.pending = state.pending.filter((op) => ids.indexOf(op.id) === -1)
    return true
  })
}

// -- 素材文件夹 ---------------------------------------------------------------

function listFolders() {
  return getState()
    .folders.filter((f) => !f.deletedAt)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
}

function getFolder(id) {
  return getState().folders.find((f) => f.id === id) || null
}

function addFolder(name) {
  return commit('folders', name, () => {
    const item = {
      id: uid('mf'),
      name: name || '新文件夹',
      coverMaterialId: '',
      sort: state.folders.length,
      createdAt: Date.now(),
      deletedAt: null
    }
    state.folders.push(item)
    return item
  })
}

function updateFolder(id, patch) {
  return commit('folders', { id }, () => {
    const f = state.folders.find((x) => x.id === id)
    if (!f) return null
    Object.assign(f, patch, { id: f.id })
    return f
  })
}

/** 删除文件夹不删素材：素材转为未分类（folder_id 为空） */
function removeFolder(id) {
  return commit('folders', { id }, () => {
    const f = state.folders.find((x) => x.id === id)
    if (!f) return false
    f.deletedAt = Date.now()
    state.materials.forEach((m) => {
      if (m.folderId === id) m.folderId = ''
    })
    return true
  })
}

function reorderFolders(ids) {
  return commit('folders', ids, () => {
    ids.forEach((id, i) => {
      const f = state.folders.find((x) => x.id === id)
      if (f) f.sort = i
    })
  })
}

// -- 素材 -------------------------------------------------------------------

function listMaterials(filter) {
  const f = filter || {}
  let list = getState().materials.filter((m) => !m.deletedAt)
  if (f.folderId !== undefined && f.folderId !== null) {
    list = list.filter((m) => (m.folderId || '') === f.folderId)
  }
  if (f.keyword) {
    const kw = String(f.keyword).toLowerCase()
    list = list.filter(
      (m) =>
        (m.name || '').toLowerCase().indexOf(kw) > -1 ||
        (m.note || '').toLowerCase().indexOf(kw) > -1
    )
  }
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

function getMaterial(id) {
  return getState().materials.find((m) => m.id === id) || null
}

/** 批量添加素材，默认名称「素材 N」 */
function addMaterials(folderId, items) {
  return commit('materials', { folderId }, () => {
    const added = items.map((it, i) => ({
      id: uid('mt'),
      folderId: folderId || '',
      url: it.url,
      name: it.name || '',
      note: it.note || '',
      createdAt: Date.now() + i,
      deletedAt: null
    }))
    state.materials.push.apply(state.materials, added)
    return added
  })
}

function updateMaterial(id, patch) {
  return commit('materials', { id }, () => {
    const m = state.materials.find((x) => x.id === id)
    if (!m) return null
    Object.assign(m, patch, { id: m.id })
    // 封面指向的素材被删或移走时，封面回退到文件夹第一张
    state.folders.forEach((f) => {
      if (f.coverMaterialId === id && patch.folderId !== undefined) {
        f.coverMaterialId = ''
      }
    })
    return m
  })
}

/** 软删除素材，进回收站 */
function removeMaterial(id) {
  return commit('materials', { id }, () => {
    const m = state.materials.find((x) => x.id === id)
    if (!m) return false
    m.deletedAt = Date.now()
    state.folders.forEach((f) => {
      if (f.coverMaterialId === id) f.coverMaterialId = ''
    })
    return true
  })
}

function restoreMaterial(id) {
  return commit('materials', { id }, () => {
    const m = state.materials.find((x) => x.id === id)
    if (!m) return false
    m.deletedAt = null
    return true
  })
}

/** 各文件夹的素材数，以及未分类数量 */
/** 素材回收站（软删除，30 天） */
function listMaterialTrash() {
  const cutoff = Date.now() - TRASH_KEEP_DAYS * 86400000
  return getState()
    .materials.filter((m) => m.deletedAt && m.deletedAt > cutoff)
    .sort((a, b) => b.deletedAt - a.deletedAt)
}

function materialCounts() {
  const counts = {}
  let unfiled = 0
  getState()
    .materials.filter((m) => !m.deletedAt)
    .forEach((m) => {
      if (!m.folderId) {
        unfiled += 1
        return
      }
      counts[m.folderId] = (counts[m.folderId] || 0) + 1
    })
  return { counts: counts, unfiled: unfiled, total: unfiled + Object.keys(counts).reduce((s, k) => s + counts[k], 0) }
}

// -- 导出 -------------------------------------------------------------------

function exportAll() {
  const s = getState()
  return {
    app: '捏土打卡',
    version: 1,
    exportedAt: new Date().toISOString(),
    shapes: s.shapes,
    tags: s.tags,
    checkIns: s.checkIns.filter((c) => !c.deletedAt),
    sales: s.sales.filter((s2) => !s2.deletedAt),
    photos: s.photos,
    folders: s.folders.filter((f) => !f.deletedAt),
    materials: s.materials.filter((m) => !m.deletedAt)
  }
}

/** 清空本机全部数据（注销账号时使用，不可恢复） */
function clearAll() {
  return commit('checkIns', null, () => {
    state.checkIns = []
    state.photos = []
    state.sales = []
    state.pending = []
    state.folders = []
    state.materials = []
    // 分类与标签回到内置默认值
    state.shapes = BUILTIN_SHAPES.map((s) => Object.assign({}, s))
    state.tags = BUILTIN_TAGS.map((t) => Object.assign({}, t))
    return true
  })
}

/** 打卡流水 CSV，便于用 Excel 做二次分析 */
function exportCsv() {
  const s = getState()
  const shapeName = {}
  s.shapes.forEach((x) => {
    shapeName[x.id] = x.name
  })
  const rows = [['日期', '造型', '数量', '耗时(分钟)', '说明', '标签', '售出数量', '售出金额', '售出日期', '渠道']]
  const soldMap = soldCountByCheckIn()
  s.checkIns
    .filter((c) => !c.deletedAt)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((c) => {
      const sales = s.sales.filter((x) => x.checkInId === c.id && !x.deletedAt)
      const tagNames = (c.tagIds || [])
        .map((t) => {
          const tag = s.tags.find((x) => x.id === t)
          return tag ? tag.name : ''
        })
        .filter(Boolean)
        .join('/')
      if (!sales.length) {
        rows.push([c.date, shapeName[c.shapeId] || '', c.count, c.durationMin || '', c.note || '', tagNames, '', '', '', ''])
        return
      }
      sales.forEach((sale) => {
        rows.push([
          c.date,
          shapeName[c.shapeId] || '',
          c.count,
          c.durationMin || '',
          c.note || '',
          tagNames,
          sale.quantity,
          sale.totalAmount,
          sale.soldDate,
          sale.channel
        ])
      })
    })
  return rows
    .map((r) => r.map((cell) => '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"').join(','))
    .join('\n')
    // 加 UTF-8 BOM，Excel 打开 CSV 才不会中文乱码
    .replace(/^/, '﻿')
}

module.exports = {
  init,
  getState,
  subscribe,
  commit,
  uid,

  listShapes,
  getShape,
  saveShape,
  removeShape,
  reorderShapes,

  listTags,
  saveTag,
  removeTag,

  listCheckIns,
  getCheckIn,
  addCheckIn,
  updateCheckIn,
  softDeleteCheckIn,
  restoreCheckIn,
  listTrash,
  purgeTrash,
  aliveCheckIns,

  listPhotos,
  addPhotos,
  removePhoto,
  setCover,

  listSales,
  addSale,
  updateSale,
  removeSale,
  soldCountByCheckIn,

  enqueue,
  pendingOps,
  clearPending,

  exportAll,
  exportCsv,
  clearAll,

  listFolders,
  getFolder,
  addFolder,
  updateFolder,
  removeFolder,
  reorderFolders,

  listMaterials,
  getMaterial,
  addMaterials,
  updateMaterial,
  removeMaterial,
  restoreMaterial,
  listMaterialTrash,
  materialCounts
}

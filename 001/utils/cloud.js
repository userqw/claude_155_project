/**
 * 云端同步（可选）。
 *
 * 本地优先：所有写入先落本地 Storage，云端只是备份与多端同步通道。
 * 未配置云开发环境时（appid 为 touristappid、或未调用 wx.cloud.init），
 * 本模块整体降级为「仅本地」模式，功能不受影响，只是数据留在本机。
 *
 * 启用方式：
 *   1. app.js 中设置 CLOUD_ENV = 'your-env-id'
 *   2. 在微信开发者工具中开通云开发，创建集合 nt_records / nt_shapes
 *   3. app.js onLaunch 调用 cloud.init()
 *
 * 冲突策略（PRD §8.2）：
 *   - 打卡记录按 updatedAt 时间戳 + 字段级合并，后写覆盖先写
 *   - 售出记录为追加型，云端不做覆盖合并
 *   - 软删除（deletedAt）作为一个普通字段同步，不做物理删除
 */

const db = require('./db')

let enabled = false
let dbRef = null

const CLOUD_ENV = '' // ← 填入云开发环境 ID 后自动启用

function init() {
  if (!CLOUD_ENV || typeof wx.cloud === 'undefined') {
    enabled = false
    return false
  }
  try {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
    dbRef = wx.cloud.database()
    enabled = true
    syncPending()
    return true
  } catch (e) {
    console.warn('[cloud] 初始化失败，退回本地模式', e)
    enabled = false
    return false
  }
}

function isEnabled() {
  return enabled
}

/** 把本地待同步队列推到云端 */
function syncPending() {
  if (!enabled || !dbRef) return Promise.resolve({ pushed: 0 })
  const ops = db.pendingOps()
  if (!ops.length) return Promise.resolve({ pushed: 0 })

  const collection = dbRef.collection('nt_records')
  const pushed = []
  ops.forEach((op) => {
    pushed.push(
      collection
        .doc(op.id)
        .set({ data: op.payload })
        .then(() => op.id)
        .catch((e) => {
          console.warn('[cloud] 同步失败，保留在队列中', op.id, e)
          return null
        })
    )
  })

  return Promise.all(pushed).then((ids) => {
    const ok = ids.filter(Boolean)
    if (ok.length) db.clearPending(ok)
    return { pushed: ok.length }
  })
}

module.exports = { init, isEnabled, syncPending }

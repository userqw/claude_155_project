const date = require('../../utils/date')
const { CHANNELS, MIN_DATE } = require('../../utils/constants')
const { money } = require('../../utils/format')

/**
 * 售出表单。
 *
 * 关键约束（PRD §6.3 / AC-3）：售出数量不能超过该条记录的未售出数量，
 * 在表单层拦截，不允许靠异常数据兜底。
 */
Component({
  properties: {
    visible: { type: Boolean, value: false },
    // 关联的打卡记录 { id, count, name }
    checkIn: { type: Object, value: null },
    // 剩余可售数量（= 记录数量 − 已售数量）
    maxQuantity: { type: Number, value: 1 },
    theme: { type: String, value: 'light' }
  },

  observers: {
    visible: function (visible) {
      if (visible) this.reset()
    }
  },

  data: {
    channels: CHANNELS,
    minDate: MIN_DATE,
    maxDate: '',
    targetName: '',
    totalText: '0',
    saving: false,
    form: {
      quantity: 1,
      unitPrice: '',
      soldDate: '',
      channel: 'xhs',
      note: ''
    }
  },

  lifetimes: {
    attached() {
      this.setData({ maxDate: date.today() })
    }
  },

  methods: {
    onStop() {},

    onClose() {
      this.triggerEvent('close')
    },

    reset() {
      clearTimeout(this._saveTimer)
      const ci = this.data.checkIn
      const shape = ci && ci.shapeName ? ci.shapeName : ''
      this.setData({
        targetName: shape,
        saving: false,
        form: {
          quantity: 1,
          unitPrice: ci && ci.defaultPrice ? String(ci.defaultPrice) : '',
          soldDate: date.today(),
          channel: 'xhs',
          note: ''
        }
      })
      this.updateTotal()
    },

    updateTotal() {
      const q = Number(this.data.form.quantity) || 0
      const p = Number(this.data.form.unitPrice) || 0
      this.setData({ totalText: money(Math.round(q * p * 100) / 100) })
    },

    onQtyInput(e) {
      let v = parseInt(e.detail.value, 10)
      if (isNaN(v) || v < 1) v = 1
      this.setData({ 'form.quantity': v })
      this.updateTotal()
    },

    onMinus() {
      if (this.data.form.quantity <= 1) return
      this.setData({ 'form.quantity': this.data.form.quantity - 1 })
      this.updateTotal()
    },

    onPlus() {
      const max = this.data.maxQuantity || 1
      if (this.data.form.quantity >= max) {
        wx.showToast({ title: '最多只能卖 ' + max + ' 个', icon: 'none' })
        return
      }
      this.setData({ 'form.quantity': this.data.form.quantity + 1 })
      this.updateTotal()
    },

    onPriceInput(e) {
      this.setData({ 'form.unitPrice': e.detail.value })
      this.updateTotal()
    },

    onDateChange(e) {
      this.setData({ 'form.soldDate': e.detail.value })
    },

    onChannel(e) {
      this.setData({ 'form.channel': e.currentTarget.dataset.id })
    },

    onNoteInput(e) {
      this.setData({ 'form.note': e.detail.value })
    },

    onSave() {
      if (this.data.saving) return
      const form = this.data.form
      const max = this.data.maxQuantity || 0
      if (max <= 0) {
        wx.showToast({ title: '这条记录已经没有可售数量了', icon: 'none' })
        return
      }
      if (form.quantity > max) {
        wx.showToast({ title: '不能超过未售出数量（' + max + '）', icon: 'none' })
        return
      }
      const price = Number(form.unitPrice)
      if (isNaN(price) || price < 0) {
        wx.showToast({ title: '填一个有效的单价', icon: 'none' })
        return
      }
      if (form.soldDate > date.today()) {
        wx.showToast({ title: '不能记录未来的售出日期', icon: 'none' })
        return
      }
      this.setData({ saving: true })
      clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => {
        if (this.data.visible) this.setData({ saving: false })
      }, 1500)
      this.triggerEvent('save', {
        checkInId: this.data.checkIn ? this.data.checkIn.id : '',
        quantity: form.quantity,
        unitPrice: Math.round(price * 100) / 100,
        soldDate: form.soldDate,
        channel: form.channel,
        note: form.note
      })
    }
  }
})

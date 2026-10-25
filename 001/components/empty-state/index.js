Component({
  properties: {
    icon: { type: String, value: '🍺' },
    title: { type: String, value: '还没有记录' },
    sub: { type: String, value: '' },
    actionText: { type: String, value: '' },
    theme: { type: String, value: 'light' }
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})

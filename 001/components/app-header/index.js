/**
 * 页面头部：头像 + 标题 + 小标签 + 副标题。
 * 四个页面共用，保证「捏土打卡 / 手作」的品牌抬头在每页一致。
 */
Component({
  properties: {
    title: { type: String, value: '捏土打卡' },
    badge: { type: String, value: '手作' },
    subtitle: { type: String, value: '' },
    avatar: { type: String, value: '🎨' },
    theme: { type: String, value: 'light' }
  }
})

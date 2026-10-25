/**
 * 状态徽标。
 * tone: 'stock' 在库 / 'sold' 已售 / 'pink' 品牌粉 / 'soft' 淡粉 / 'purple' 紫
 * size: 'sm' 32rpx / 'md' 40rpx（默认）/ 'lg' 48rpx
 */
Component({
  properties: {
    text: { type: String, value: '' },
    tone: { type: String, value: 'pink' },
    outline: { type: Boolean, value: false },
    size: { type: String, value: 'md' },
    theme: { type: String, value: 'light' }
  }
})

# 捏土打卡 · 微信小程序

粘土手作每日打卡与统计工具。按 [PRD](./捏土打卡小程序-PRD.md) V1.0 实现。

记录每天做了什么造型（OB11娃头 / QQ人 / 正比）、做了几个、配上照片，
统计每年的产量与营收。

---

## 跑起来

**用微信开发者工具打开**：导入本目录（`001/`），AppID 选「测试号」或使用你自己的 AppID，
基础库选 3.0.0 以上。没有构建步骤，没有 npm 依赖。

> 图表用了 Canvas 2D API（`type="2d"`），需要基础库 ≥ 2.9.0。

**跑测试**（纯 node，不需要装任何东西）：

```bash
node test/stat.test.js        # 统计引擎验收测试（对照 PRD §12 的 AC-2/3/4/6）
node test/auth.test.js        # 账号与登录验收测试（对照 PRD §12 的 AC-8~AC-12）
node test/material.test.js    # 素材库验收测试（对照 PRD §12 的 AC-13~AC-15）
node test/structure.test.js   # 结构一致性检查：页面/组件路径、require、事件绑定、跳转目标
```

三个脚本都会 mock 掉 `wx` API，在 node 里直接跑 `utils/` 下的模块。

---

## 目录结构

```
app.js / app.json / app.wxss     入口；app.wxss 只放页面级规则
styles/
  theme.wxss     主题变量（.theme-light / .theme-dark）
  common.wxss    跨页面、跨组件的公共类（.card / .btn / .row …）
utils/
  db.js         本地优先数据层：wx Storage + 软删除 + 每日备份 + 变更广播
  stat.js       统计引擎（PRD §6.3 口径）——全项目只有这一处算数
  auth.js       账号与登录（游客优先）：状态机、wx.login、后端调用
  photos.js     选图 + 本地持久化（打卡照片与素材共用）
  config.js     后端接口配置（apiBase 或 cloudFunction）
  constants.js  色板 / 内置分类 / 标签 / 渠道 / 阈值
  canvas.js     Canvas 2D 绘图工具（圆角路径、网格线、坐标轴）
  date.js       本地时区日期工具
  format.js     金额 / 紧凑数字 / 轴刻度
  cloud.js      云同步（未配置环境时整体降级为仅本地）
components/
  app-header    页面抬头（头像 + 标题 + 手作标签 + 副标题）
  badge         状态徽标（在库中 / 已售出 / 限定 …）
  chart-bar     柱状图（Canvas）
  chart-hbar    横向条形图（view）
  chart-line    折线图（Canvas）
  stat-tile     统计数值卡片（可选图标徽章 + 状态点说明）
  empty-state   空状态
  shape-picker  造型选择器（四列圆形色块）
  photo-uploader 照片选择与本地持久化
  sale-sheet    售出表单弹层
pages/
  index             首页（打卡主入口：折叠引导卡 → 点「去打卡」跳打卡页）
  checkin           打卡页（新建 / 日历补录 / 详情编辑三种入口共用）
  stats/year        年度统计
  stats/calendar    日历热力图
  stats/revenue     营收统计
  library/list      作品库（瀑布流 + 筛选）
  library/detail    作品详情
  mine/index        我的（账号卡片 / 库存明细 / 回收站）
  mine/account      账号设置（备份 / 退出 / 注销）
  material/         素材库：index（文件夹 + 全部素材）· list（文件夹内素材）· detail（素材详情）
  mine/shapes       造型管理
  mine/tags         标签管理
  mine/export       数据导出
  login             登录页（微信一键登录 + 先随便看看）
```

---

## 账号与登录：游客优先

**浏览永远不被强制登录。** 未登录时打卡、编辑、记录售出、看统计、翻作品库全部照常，
只在首页顶部出现一条可关闭的引导条。想用的时候再点「登录」。

- 登录页在 `/pages/login/index`，注册是隐式的（服务端第一次见到 `openid` 就建号），
  不收手机号、不做实名。头像昵称走 `chooseAvatar` / `type="nickname"`，均为选填。
- 「先随便看看」进入游客模式，之后不再被引导条打扰，本地功能一条不少。
- 退出登录**不删本地数据**；只有「注销账号」才会同时清掉云端与本机数据。

### 接入后端

客户端只依赖这几个接口（PRD §5.6.2 有完整契约）：

```
POST /api/login          { code }                        → { token, account }
POST /api/profile        { token, nickname, avatarUrl }  → { account }
POST /api/sync/push      { token, deviceId, records… }   → { serverTime }
POST /api/sync/pull      { token, since }                → { serverTime, records… }
POST /api/account/delete { token }                       → { deleted }
```

在 `utils/config.js` 里二选一配置：

```js
apiBase: 'https://api.example.com',   // 直连 HTTP
// cloudFunction: 'login',             // 或走云开发云函数
```

**后端没配时**：登录页会提示「登录服务还未配置」，所有功能照常可用（纯本地），
登录页底部有「开发者模式」可以本地模拟登录，用来预览已登录界面。

---

## 六个最容易踩坑的地方
1. **产量按打卡日期归属，营收按售出日期归属。** 1 月做的、5 月卖的，
   产量算 1 月，营收算 5 月。这条规则只在 `utils/stat.js` 里实现，页面不要自己按日期过滤营收。

2. **删除是软删除。** 打卡记录删掉后进回收站，30 天内可恢复，统计数字实时回滚。
   物理清理由「我的 → 清空回收站」触发。

3. **售出数量不能超过该条记录的未售出数量**，在表单层拦截（`sale-sheet`），
   不靠异常数据兜底。跨年卖出等特殊情况会让「未售出」算成负数，此时按 0 显示并给出提示。

4. **不要给登录加拦截。** `utils/auth.js` 里刻意没有 `navigateTo` / `showModal`——
   任何强制登录的改动都会让「浏览不被强制」这条验收标准失效。

5. **组件样式必须自己 import 主题变量。** 小程序自定义组件默认样式隔离，
   `app.wxss` 里的规则**匹配不到组件内部的节点**。所以组件里的 `var(--surface)`
   取不到值，`background` 会退化成 `transparent`——表现就是「弹层透明、字看不清」。
   每个组件的 wxss 第一行必须有：

   ```css
   @import "../../styles/theme.wxss";
   ```

   用了 `.btn` / `.card` 这类公共类名还要再 import `styles/common.wxss`。
   `test/structure.test.js` 里有两条守卫会盯住这件事。

6. **wxml 里 bindtap 的方法必须在 js 里存在。** 小程序不会为此报错，
   只会留一句 handler not found，点起来就是「没反应」。
   `test/structure.test.js` 现在同时检查页面**和组件**的事件处理函数。

7. **自定义组件的样式隔离会挡住父级选择器。** 父级的 `.cover-wrap .badge` 打不进
   `badge` 组件内部，组件根节点也不带父级的 class——要让组件浮在图片右上角，
   得用一层定位容器包起来（见 `pages/library/list/index.wxml` 的 `.cover-status`）。

8. **底部弹层的提交按钮不能被内容顶出屏幕。** 弹层高度要用**固定的 `height`**
   （不是只给 `max-height`），滚动区用 `flex: 1 1 0; height: 0; min-height: 0`，
   提交区 `.footer` 必须 `flex: none` 并带 `background`。
   高度不确定时 `scroll-view` 会把内容撑开，底部按钮就落到可视区外去了。
   `test/structure.test.js` 里有一条守卫会检查 `.footer` 有没有 `flex: none`。

---

## 当前实现的边界

- **后端未接入**。`utils/auth.js` 的客户端流程（登录页、跳过、状态机、账号设置、合并）
  已按 PRD §5.6 实现完毕，缺的是 `/api/login` 等服务端接口；
  `utils/config.js` 填入地址后即可打通，接入前功能不阻塞。
- **照片暂不同步**。V1.0 只同步记录与售出的元数据，照片云端同步排在 V1.1。
- **未做**：订阅消息提醒、成本与利润（字段已预留）、年度分享长图、商城。
  这些在 PRD 的 V1.1 / V2.0 范围里。
- **PRD §13 的待确认问题**尚未定论：`OB11` 是否拆子类、是否需要拆件级计数、成本字段是否本期做、
  后端用什么形态、注销后能否恢复。当前实现按「单一分类 + 成品级计数 + 成本字段预留 +
  接口与后端实现解耦 + 注销不可恢复」处理。

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/claude) when working with code in this repository.

## Repository status

One product, four layers:

- `001/` — the WeChat mini-program (捏土打卡): openable directly in 微信开发者工具 (no build step, no npm)
  - `001/捏土打卡小程序-PRD.md` — the product requirements document (source of truth)
  - `001/test/` — node-based tests, run with plain `node`
- `002.产品UI原型（美术设计）/` — Stitch 生成的原型（HTML + 截图）
- `003.前端代码/` — Stitch 原型代码 + `sakura_clay_studio/DESIGN.md`（**视觉规范来源**）
- `004数据库脚本/` — MySQL 8 表结构 / 视图 / 种子数据 / 同步语句（已在本地 MySQL 实跑验证）
- `005.后端代码/` — Spring Boot 3 服务端 API（Maven + JDK 21）

**There is a git repo (remote: GitHub) and there is no npm and no lint setup.** Don't invent npm scripts.

### Commands

```bash
# 后端集成测试（跑真实 MySQL，需要先建好 004 的库 + 配好 application-local.yml）
cd 005.后端代码 && mvn test

# 启动后端（默认 profile = dev,local：假 code2session + 本机数据库密码）
cd 005.后端代码 && mvn spring-boot:run

# 结构一致性检查：页面/组件路径、require 路径、事件绑定、跳转目标
node 001/test/structure.test.js

# 统计引擎验收测试（对照 PRD §12 的 AC-2/3/4/6），会 mock 掉 wx API
node 001/test/stat.test.js

# 账号与登录验收测试（对照 PRD §12 的 AC-8~AC-12）
node 001/test/auth.test.js

# 素材库验收测试（对照 PRD §12 的 AC-13~AC-15）
node 001/test/material.test.js

# 导航栏验收测试（底部 tab bar 的每个 tab 都能跳、登录页不会把人困住）
node 001/test/nav.test.js

# 样式与配色校验
node 001/test/style.test.js && node 001/test/theme.test.js
```

Open the app in 微信开发者工具 by importing the `001/` directory (appid 见 `001/project.config.json`, 基础库 3.0.0+).
Canvas charts use the Canvas 2D API (`type="2d"`), which needs 基础库 ≥ 2.9.0.

### Layout

```
001/
├── app.js / app.json / app.wxss      入口；app.wxss 只放页面级规则，变量在 styles/
├── custom-tab-bar/   悬浮药丸 tab bar（原生 tabBar 加 "custom": true 后接管）
├── styles/
│   ├── theme.wxss    主题令牌（.theme-light / .theme-dark）——组件必须各自 import
│   └── common.wxss   跨页面跨组件的公共类（.card / .btn / .row / .page-tabbed …）
                     所有色值只写在 theme.wxss，页面里一律 var(--…)
├── utils/
│   ├── db.js        本地优先数据层：wx Storage + 软删除 + 每日备份 + 变更广播
│   ├── stat.js      统计引擎（PRD §6.3 口径），全项目只有这一处算数
│   ├── auth.js      账号状态机（游客优先）——刻意不含任何页面跳转
│   ├── photos.js    选图 + 本地持久化（打卡照片与素材共用）
│   ├── config.js    后端接口配置（apiBase 或 cloudFunction）
│   ├── constants.js 色板 / 内置分类 / 标签 / 渠道
│   ├── canvas.js    Canvas 2D 绘图工具（圆角路径、网格线、轴）
│   ├── date.js      本地时区日期工具
│   ├── format.js    金额 / 紧凑数字 / 轴刻度
│   └── cloud.js     云同步（未配置环境时整体降级为仅本地）
├── components/      app-header / badge / chart-bar / chart-hbar / chart-line
│                    stat-tile / empty-state / shape-picker / photo-uploader
│                    sale-sheet
└── pages/           index · checkin · stats/{year,calendar,revenue}
                     library/{list,detail} · mine/{index,account,shapes,tags,export}
                     · login · material/{index,list,detail}
```

`001/` is the working directory for this project; the numeric prefix suggests the repo may hold multiple projects side by side, so keep new project files under `001/` unless the user says otherwise.

## Frontend ↔ backend wiring

`001/utils/config.js` 的 `apiBase` 指向 `005.后端代码` 跑起来的服务（默认 `http://127.0.0.1:8080`）。
微信开发者工具要勾「不校验合法域名…」才能连本机；真机预览要换成电脑的局域网 IP。

**「点击没反应」几乎都是这几条之一坏了**，改任何一边都要同时改另一边：

| 约定 | 说明 |
| --- | --- |
| 响应包裹 | HTTP 200 + `{ code, message, data }`；`code !== 0` 是**业务失败**，前端必须当错误处理 |
| token 位置 | 只在 `Authorization: Bearer <token>` 头，**不放 body**；登录接口本身不带 |
| 登录返回 | `{ token, account: { openid, … }, newUser, expireSeconds }`——`account` 是对象，不是扁平字段 |
| 时间戳 | 一律 ISO-8601；服务端按 UTC 存和比 |
| 未知字段 | 前端多传字段不该 500——DTO 都有 `@JsonIgnoreProperties(ignoreUnknown = true)` |
| 软删除 | 客户端发 `deleted: true` **或** `deletedAt` 非空，任一成立即视为删除 |

`utils/auth.js` 是这条链路的唯一实现——它既要带 token，又要判业务码，还要把裸毫秒时间戳转成 ISO 字符串。
这三个职责都在同一个 `request()` 里，改的时候一起改。

### 「登录了但数据库里没这个账号」

先看**后端日志有没有收到 `/api/login`**。没有的话，问题在小程序和后端之间，
不在后端：

- **模拟器 vs 真机用的是不同地址。** 模拟器里 `127.0.0.1` 是你的电脑；
  真机预览时 `127.0.0.1` 指的是**手机自己**，必然连不上。
  `config.js` 的 `apiCandidates` 存了电脑的局域网 IP（`ipconfig` 看 IPv4），
  登录前会挨个探活 `GET /api/health`，谁通用谁。
- **合法域名校验。** 开发者工具：详情 → 本地设置 → 勾「不校验合法域名…」。
- **别把微信的 errMsg 吞掉。** `request()` 的 `fail` 会给出
  `url not in domain list` / `timeout` / 连接被拒——
  这些长得完全不一样，`describeNetworkError()` 负责翻译成人话。
  一律吞成「网络连接失败」等于让人对着黑盒猜。

### 「底部导航栏点了没反应」

自定义 tab bar 的每个 `pagePath` 必须同时出现在两处：

1. `custom-tab-bar/index.js` 的 `list`
2. `app.json` 的 `tabBar.list`

少一处，`wx.switchTab` 会**静默失败**——不报错，点了就是没反应。
`test/nav.test.js` 盯着这件事，也盯着 `wx:key` 指向的字段是不是真的存在。

另外：`custom-tab-bar` 由框架注入，**不要**在各 tab 页面的 `usingComponents`
里重复声明；也不要开 `lazyCodeLoading: "requiredComponents"`——
自定义 tab bar 与「按需注入」的组合会让 tab bar 变得不可靠，
而十几个页面的启动收益本来就可以忽略。

## Source of truth

The PRD is the spec. Read it before making product or schema decisions; when the code and the PRD disagree, the PRD wins until the user says it has been updated.

Key sections worth re-reading before implementation work:

- **§5** — feature requirements (打卡 / 统计 / 作品库 / 我的), including field tables, interaction rules, and edge cases
- **§6.2** — data model (`check_in`, `photo`, `sale`, `shape`, `tag`); use these table and column names verbatim in code and migrations
- **§6.3** — statistical definitions; the attribution rules here are the most bug-prone part of the codebase
- **§7** — page list with the intended page paths (`/pages/index/index`, `/pages/stats/year`, `/pages/library/list`, …)
- **§12** — acceptance criteria, usable as the test case source

## Domain rules that are easy to get wrong

These are the recurring traps; follow them even when a change looks locally reasonable.

1. **Production is attributed to the check-in date; revenue is attributed to the sale date.** A piece made in January and sold in May counts in January's production but May's revenue. Year/month aggregations of the two use different keys on purpose.
2. **Production volume vs. sold count are not the same measure.** `累计产量` = sum of `check_in.count`; `未售出` = 累计产量 − 售出数量. If sold count exceeds production (possible via manual records), display 0 for 库存 and surface a warning rather than showing a negative number.
3. **Sale quantity is capped** by the remaining unsold quantity of its parent check-in record. Enforce in the form, not just the UI.
4. **Daily average** divides by days *with records*, not by days in the year. The UI must state this basis.
5. **Record deletion is soft** — `status = 'deleted'`, recoverable from a 30-day trash, with statistics rolled back immediately on delete and restore.
6. **Shape categories** (造型): `OB11娃头`, `QQ人`, `正比` are built-in — renameable and re-orderable, but not deletable. `其他` is a catch-all. User-defined shapes may be added. These three are the fixed taxonomy that all yearly statistics aggregate over.
7. **Local-first storage**: write to local storage first, then sync to the cloud; a check-in must succeed offline and upload later.
8. **Guest-first login (PRD §5.6)**: browsing is never forced to log in. Reading stats, browsing the library, *and writing check-ins/sales* all work while logged out; the only prompt is a dismissible banner on the home page. `utils/auth.js` deliberately contains no `navigateTo` / `showModal` — don't add any, or AC-8/AC-12 break. Logging out must never delete local records; only "注销账号" clears both sides.
9. **No hardcoded colors in page/component styles.** Every color comes from `styles/theme.wxss` via `var(--…)`; `test/style.test.js` fails otherwise. The theme file is the single place to change a color — including the pink/green/purple tints, which are tokens (`--pink-16`, `--green-16`, `--purple-20`, …), not inline rgba().
10. **Deleting a material folder must not delete its materials.** `removeFolder` moves them to 未分类 (`folder_id = ''`). Material deletion is soft (30-day trash) like check-ins.
11. **Every `bindtap`/`bindchange` in a wxml must have a handler in the matching js.** WeChat does not error on a missing handler — the tap just silently does nothing. `test/structure.test.js` checks pages *and* components for this; it is the guard behind "点击没反应".
12. **Component styles must import the theme themselves.** Custom components are style-isolated: `app.wxss` rules do not match nodes inside a component, so `var(--surface)` resolves to nothing and the background silently becomes transparent. Every component's wxss starts with `@import "../../styles/theme.wxss";` (plus `styles/common.wxss` if it uses `.btn`/`.card`/`.row`). Theme tokens live in `styles/theme.wxss` only — `test/structure.test.js` enforces both rules.
13. **Everything time-related is UTC.** The client uploads ISO-8601 UTC timestamps; the server stores and compares them as UTC. The JVM default timezone is forced to UTC by `config/TimeZoneConfig.java` — *not* only in `main()`, because `@SpringBootTest` never calls `main()` and the tests would otherwise run in local time. If client and server disagree by 8 hours, the "后写覆盖先写" merge silently keeps the wrong version.
14. **Credentials never enter the repo.** The MySQL password lives in `005.后端代码/src/main/resources/application-local.yml` (gitignored; a tracked `application-local.template.yml` sits next to it). The appid lives in `001/project.config.json` (gitignored; `001/project.config.template.json` is tracked). Don't move either into a tracked file, and don't paste a live token or password into a commit message, a log, or the transcript.

## Design system

Chart colors are fixed in the PRD §5.2.1 and are **validated**, not chosen by eye — both modes pass
`validate_palette.js` (lightness band, chroma floor, adjacent-pair CVD ΔE, normal-vision ΔE, contrast).
Do not substitute a general palette; if a color must change, re-run the validator for both modes and
keep the failure case in mind.

| 分类 | 亮色 (surface `#FFFFFF`) | 暗色 (surface `#1A1A19`) |
|---|---|---|
| OB11娃头 | `#EB6834` | `#D95926` |
| QQ人 | `#2A78D6` | `#3987E5` |
| 正比 | `#1BAF7A` | `#199E70` |
| 其他 | `#6250D6` | `#9085E9` |

User-created shapes take the extension slots `#EDA100` / `#E87BA4` / `#008300` / `#E34948` in fixed order — never cycled, never a generated hue. The calendar heat map uses a single-hue terracotta ramp (not the categorical palette).

**Light-mode `#1BAF7A` is 2.82:1 against white** — below 3:1, so every chart must carry direct value labels. Tooltips may enhance but must never be the only way to read a value; the monthly chart also ships a table view.

Body-on-background contrast must stay at ≥ 4.5:1, including in dark mode (dark mode is a PRD requirement, not optional).

## Open decisions

§13 of the PRD lists eight unanswered questions, three of which affect the data model and should be settled before writing schema or migrations:

- whether `OB11` is one shape or should split into sub-types
- whether piece-level (per-part) counting is needed
- whether cost tracking ships in this version or is only a reserved field

Ask the user rather than assuming on these.

## Language

The product is Chinese-language, and so are its users, copy, and identifiers in the PRD. UI strings, comments, and domain terms (打卡, 造型, 回收站, 售出) are Chinese. Code identifiers may be English or Chinese, but keep the PRD's exact domain vocabulary when it appears in user-facing text.

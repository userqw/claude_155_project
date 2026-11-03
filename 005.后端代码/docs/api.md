# 捏土打卡 · 服务端 API 契约

本文是 `005.后端代码`（Spring Boot 3）对前端暴露的**唯一接口契约**。
前端只需要改一行 baseURL 就能对上这份文档。

- 服务默认监听 `http://127.0.0.1:8080`
- 交互式文档（Swagger UI）：`http://127.0.0.1:8080/swagger-ui.html`
- 机器可读契约（OpenAPI JSON）：`http://127.0.0.1:8080/v3/api-docs`

---

## 1. 通用约定

### 1.1 响应体

**所有接口**（含错误）都返回 HTTP **200**，body 恒为：

```json
{ "code": 0, "message": "ok", "data": { } }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | int | 业务状态码。`0` = 成功；非 0 = 业务失败 |
| `message` | string | 人话提示，可直接展示给用户 |
| `data` | any | 业务数据。失败时为 `null` |

> **关键**：`code !== 0` 是**业务失败**，不是 HTTP 错误。
> 不要用 `res.ok` 判断成败，要先看 `code`。

### 1.2 鉴权

- token 放在请求头：`Authorization: Bearer <token>`
- **不要**把 token 放进 body、query 或自定义头
- 免鉴权的接口只有两个：`POST /api/login`、`GET /api/health`
- 其余接口缺 token 或 token 失效，一律返回 `code: 401`
- 服务端按 token 里的 **openid** 过滤数据，**所有数据按 openid 隔离**：
  别人的打卡记录、素材、标签互相看不见，也改不了

### 1.3 时间

- 一律 **ISO-8601**，带时区，形如 `2026-03-10T10:15:30.000Z`
- **禁止裸毫秒时间戳**（`1773233730000` 这种），前端一律用 `new Date(iso).getTime()` 换算
- 日期（打卡日、售出日）用 `2026-03-10` 这样的 `YYYY-MM-DD`
- 服务端按 **UTC** 存和比。客户端也建议直接发 UTC 的 ISO 串
- 服务端返回的时间戳**带 `Z` 后缀**（如 `2026-03-10T10:15:30.000Z`），值本身就是 UTC。
  JavaScript 的 `new Date("2026-03-10T10:15:30.000Z")` 能直接解析成正确的 UTC 时刻——
  **不要自己补 `Z`**，补两次会差 8 小时。
- 入参也认带 `Z` 的串（同步协议上传的就是这种），服务端会去掉 `Z` 按 UTC 解析

### 1.4 分页

只有打卡列表是分页的。

| 入参 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | int | `1` | 页码，**从 1 开始**（不是 0） |
| `size` | int | `20` | 每页条数，**上限 100**。服务端会夹紧到 100，客户端也可以自己夹一次 |

分页出参固定形状：

```json
{ "records": [], "total": 0, "page": 1, "size": 20, "pages": 0 }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `records` | array | 当前页数据 |
| `total` | long | 总条数 |
| `page` | long | 当前页码 |
| `size` | long | 每页条数 |
| `pages` | long | 总页数 |

### 1.5 金额与数量

- 金额一律 `BigDecimal` 序列化成 JSON number（`12.50`），**不要**当字符串处理
- 数量、条数、天数是整数（`Long` / `int`）
- `avgPerDay`、`avgPrice`、`rate` 这类均值可能带小数，也可能为 `null`（分母为 0 时）

---

## 2. 错误码表

| code | 含义 | 典型场景 | 前端该怎么办 |
| --- | --- | --- | --- |
| `0` | 成功 | — | 取 `data` |
| `400` | 参数不合法 | 必填项缺失、取值越界、数量超过未售出、删内置品类 | 提示 `message`，让用户改输入 |
| `401` | 未登录或登录已过期 | 没带 token、token 过期、账号已注销 | 清掉本地 token，跳登录页 |
| `403` | 无权 | 访问了别人的资源 | 提示 `message` |
| `404` | 不存在 | 改/删一条不存在的记录 | 刷新列表 |
| `500` | 内部错误 | 数据库异常、未预期异常 | 提示「服务器开小差了」，可重试 |

> 客户端要能区分「网络不通（没拿到 HTTP 响应）」和「业务失败（拿到了 code）」，
> 前者不是上表中的任何 code。

---

## 3. 接口总表（45 个）

| # | 方法 | 路径 | 用途 | 鉴权 |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/login` | 微信一键登录（首次登录自动注册） | 免 |
| 2 | GET | `/api/profile` | 取当前账号资料 | 需要 |
| 3 | POST | `/api/profile` | 修改昵称头像 | 需要 |
| 4 | POST | `/api/account/delete` | 注销账号并清空该账号云端全部数据 | 需要 |
| 5 | GET | `/api/health` | 健康检查（探活） | 免 |
| 6 | GET | `/api/checkin` | 分页查询打卡记录 | 需要 |
| 7 | POST | `/api/checkin` | 新建打卡记录 | 需要 |
| 8 | PUT | `/api/checkin/{id}` | 修改打卡记录 | 需要 |
| 9 | DELETE | `/api/checkin/{id}` | 软删除打卡记录（进 30 天回收站） | 需要 |
| 10 | POST | `/api/checkin/{id}/restore` | 从回收站恢复 | 需要 |
| 11 | GET | `/api/shapes` | 列出全部品类（含内置） | 需要 |
| 12 | POST | `/api/shapes` | 新建自定义品类 | 需要 |
| 13 | PUT | `/api/shapes/{id}` | 修改品类 | 需要 |
| 14 | DELETE | `/api/shapes/{id}` | 删除自定义品类（历史记录迁到「其他」） | 需要 |
| 15 | POST | `/api/shapes/reorder` | 调整品类顺序 | 需要 |
| 16 | GET | `/api/tags` | 列出全部标签 | 需要 |
| 17 | POST | `/api/tags` | 新建标签 | 需要 |
| 18 | PUT | `/api/tags/{id}` | 修改标签 | 需要 |
| 19 | DELETE | `/api/tags/{id}` | 删除标签（内置的不可删） | 需要 |
| 20 | GET | `/api/sales` | 列出售出记录 | 需要 |
| 21 | POST | `/api/sales` | 新增售出记录 | 需要 |
| 22 | DELETE | `/api/sales/{id}` | 撤掉一条售出记录（软删除） | 需要 |
| 23 | GET | `/api/trash` | 回收站列表 | 需要 |
| 24 | DELETE | `/api/trash` | 彻底删除一条（不可恢复） | 需要 |
| 25 | DELETE | `/api/trash/all` | 清空回收站 | 需要 |
| 26 | GET | `/api/material/folder` | 文件夹列表 | 需要 |
| 27 | POST | `/api/material/folder` | 新建文件夹 | 需要 |
| 28 | PUT | `/api/material/folder/{id}` | 文件夹改名 | 需要 |
| 29 | POST | `/api/material/folder/reorder` | 调整文件夹顺序 | 需要 |
| 30 | DELETE | `/api/material/folder/{id}` | 删除文件夹（素材不删，转「未分类」） | 需要 |
| 31 | GET | `/api/material` | 素材列表（可按文件夹过滤） | 需要 |
| 32 | POST | `/api/material` | 新增素材 | 需要 |
| 33 | PUT | `/api/material/{id}` | 修改素材的名称、备注、所属文件夹 | 需要 |
| 34 | DELETE | `/api/material/{id}` | 删除素材（软删除） | 需要 |
| 35 | GET | `/api/stats/year` | 年度总览：产量、营收、未售出、日均 | 需要 |
| 36 | GET | `/api/stats/compare` | 跨年对比（与上一年比产量） | 需要 |
| 37 | GET | `/api/stats/monthly-production` | 按月的产量 | 需要 |
| 38 | GET | `/api/stats/monthly-revenue` | 按月的营收 | 需要 |
| 39 | GET | `/api/stats/shapes` | 造型分布（按年） | 需要 |
| 40 | GET | `/api/stats/shape-revenue` | 按造型的结缘金 | 需要 |
| 41 | GET | `/api/stats/channel-revenue` | 按渠道的结缘金 | 需要 |
| 42 | GET | `/api/stats/inventory` | 库存（累计口径，跨年结转） | 需要 |
| 43 | GET | `/api/stats/daily` | 逐日产量（日历热力图） | 需要 |
| 44 | POST | `/api/sync/push` | 推送本地变更 | 需要 |
| 45 | GET | `/api/sync/pull` | 拉取增量变更 | 需要 |

---

## 4. 接口详情

### 4.1 账号

#### 4.1.1 `POST /api/login` — 微信一键登录

**用途**：用 `wx.login()` 拿到的临时 `code` 换服务端 token。首次登录自动注册。
**鉴权**：免。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `code` | string | 是 | `wx.login()` 返回的临时 code，5 分钟有效 |
| `nickname` | string | 否 | 昵称。**微信不会把它给后端**，只能由用户点 `<input type="nickname">` 拿到后随请求带上 |
| `avatarUrl` | string | 否 | 头像地址 |

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `token` | string | JWT，之后放 `Authorization: Bearer <token>` |
| `account` | object | 账号信息，**是对象不是扁平字段**，见下 |
| `newUser` | boolean | 本次是否首次注册 |
| `expireSeconds` | long | token 剩余有效期（秒） |
| `mock` | boolean | 服务端是否在 mock 模式 |

`account` 对象：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `openid` | string | 用户在本小程序下的唯一标识 |
| `unionid` | string | 开放平台统一标识，没绑定开放平台时为 `null` |
| `nickname` | string | 昵称 |
| `avatarUrl` | string | 头像 |
| `createdAt` | string | 注册时间，ISO-8601 |

> **`mock: true` 的含义**：服务端没配小程序 `appid`/`secret`，openid 是
> `md5(code)` 编出来的，**不是用户的真实微信号**，数据库里自然查不到。
> 客户端要把它显示出来（「我的 → 账号设置」有专门的一块），别让用户对着数据库找自己的账号。
> 配齐 `WECHAT_APP_ID` / `WECHAT_SECRET` 并把 `WECHAT_MOCK=false` 之后 `mock` 变 `false`。
> 启动时用 `GET /api/profile` 同步一次这个状态。

**错误码**：`400` code 为空；`401` token 过期或账号已注销。

---

#### 4.1.2 `GET /api/profile` — 取当前账号资料

**用途**：拿当前账号的昵称头像，同时同步 `mock` 状态。
**鉴权**：需要。

**入参**：无（query）。

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `account` | object | 同 4.1.1 的 `account` |
| `mock` | boolean | 同 4.1.1 |

**错误码**：`401` 未登录。

---

#### 4.1.3 `POST /api/profile` — 修改昵称头像

**用途**：只改资料，不重新登录。
**鉴权**：需要。

> **注意**：「我的 → 账号设置 → 修改头像与昵称」走这个接口；
> 「我的 → 微信一键登录」走 `POST /api/login`。两者别混，
> 混了会出现「登录没反应，账号反倒没了」。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `nickname` | string | 否 | 新昵称 |
| `avatarUrl` | string | 否 | 新头像地址 |

**出参** `data`：同 4.1.2 的 `{ account, mock }`。

**错误码**：`400` 参数不合法；`401` 未登录。

---

#### 4.1.4 `POST /api/account/delete` — 注销账号

**用途**：注销账号，并**物理清空该账号云端的全部数据**（打卡、照片、售出、素材、文件夹、品类、标签）。
**鉴权**：需要。

**入参**：无 body。

**出参** `data`：`{ "deleted": true }`

> **注意**：服务端当前实现的 `data` 实际为 `null`。
> 前端按 `code === 0` 判定成功即可，不要依赖 `data.deleted` 的值。
> 另外：**注销账号 ≠ 退出登录**。退出登录只清本地 token、隐藏本地内容，
> 注销才清两边。注销后当前 token 立刻失效，再调任何接口都是 `401`。

**错误码**：`401` 未登录。

---

#### 4.1.5 `GET /api/health` — 健康检查

**用途**：探活。切换后端地址时先打这个。
**鉴权**：免。

**入参**：无。

**出参** `data`：`"ok"`（字符串）

**错误码**：无业务失败。

---

### 4.2 打卡

#### 4.2.1 `GET /api/checkin` — 分页查询打卡记录

**用途**：按年、按品类翻页查打卡记录。
**鉴权**：需要。

**入参**（query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `year` | int | 否 | 只查该年的记录。不传 = 全部年份 |
| `shapeId` | string | 否 | 只查某个品类的记录。不传 = 全部 |
| `page` | int | 否 | 页码，从 1 开始，默认 1 |
| `size` | int | 否 | 每页条数，默认 20，上限 100 |

**出参** `data`：分页对象（见 §1.4），`records` 元素为 **CheckInVo**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 记录 id（客户端生成，形如 `ci_xxx`） |
| `date` | string | 打卡日期 `YYYY-MM-DD`。**产量按这个日期归属** |
| `shapeId` | string | 品类 id |
| `shapeName` | string | 品类名（出参时带上了，前端不用再查一次） |
| `count` | int | 数量 |
| `note` | string | 备注 |
| `durationMin` | int | 耗时（分钟） |
| `coverPhotoId` | string | 封面照片 id |
| `soldCount` | int | 已售出数量 |
| `unsold` | int | 未售出数量 = `count − soldCount`，**不会小于 0** |
| `createdAt` | string | 创建时间，ISO-8601 |
| `updatedAt` | string | 最后修改时间，ISO-8601 |

排序：按 `date` 倒序，同日按 `createdAt` 倒序。

**错误码**：`400` 参数不合法；`401` 未登录。

---

#### 4.2.2 `POST /api/checkin` — 新建打卡记录

**用途**：新建一条打卡。
**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 校验 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | string | 否 | ≤ 64 字符 | 客户端生成的主键，形如 `ci_xxx`。留空则服务端生成 |
| `date` | string | 是 | `YYYY-MM-DD` | 打卡日期 |
| `shapeId` | string | 是 | 非空，≤ 64 字符 | 品类 id |
| `count` | int | 是 | 1 ~ 999 | 数量 |
| `note` | string | 否 | ≤ 200 字 | 备注 |
| `durationMin` | int | 否 | 0 ~ 1440 | 耗时（分钟） |
| `coverPhotoId` | string | 否 | ≤ 64 字符 | 封面照片 id |
| `tagIds` | string[] | 否 | — | 标签 id 列表 |
| `photos` | object[] | 否 | — | 照片列表，元素为 PhotoDto（见 4.10） |

**出参** `data`：**CheckInDto**（比 Vo 多几个字段，因为出参里带了关联数据）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 记录 id |
| `date` | string | 打卡日期 |
| `shapeId` | string | 品类 id |
| `count` | int | 数量 |
| `note` | string | 备注 |
| `durationMin` | int | 耗时（分钟） |
| `coverPhotoId` | string | 封面照片 id |
| `tagIds` | string[] | 标签 id 列表 |
| `photos` | object[] | 照片列表 |
| `sales` | object[] | 售出记录列表 |
| `deleted` | boolean | 是否已删除（软删除墓碑），正常是 `false` |
| `updatedAt` | string | 最后修改时间，ISO-8601 |
| `deletedAt` | string | 软删除标记，正常是 `null` |

**错误码**：`400` 必填缺失/取值越界（如「填一下做了几个」）；`401` 未登录。

---

#### 4.2.3 `PUT /api/checkin/{id}` — 修改打卡记录

**用途**：整条更新。
**鉴权**：需要。

**入参**：路径参数 `id`（string，必填）；body 同 4.2.2。

**出参** `data`：同 4.2.2 的 CheckInDto。

**错误码**：`400` 参数不合法；`401` 未登录；`404` 记录不存在。

---

#### 4.2.4 `DELETE /api/checkin/{id}` — 软删除打卡记录

**用途**：删掉一条打卡。**软删除**，进 30 天回收站，统计立刻回滚，可恢复。
**鉴权**：需要。

**入参**：路径参数 `id`（string，必填）。无 body。

**出参** `data`：`null`（`code === 0` 即成功）。

**错误码**：`401` 未登录；`404` 记录不存在。

---

#### 4.2.5 `POST /api/checkin/{id}/restore` — 从回收站恢复

**用途**：把一条软删除的记录恢复回来，统计同时回滚。
**鉴权**：需要。

**入参**：路径参数 `id`（string，必填）。无 body。

**出参** `data`：`null`（`code === 0` 即成功）。

**错误码**：`401` 未登录；`404` 记录不存在。

---

### 4.3 品类（造型）

内置四个品类：**OB11娃头 / QQ人 / 正比 / 其他**。
`builtin: true` 的**可改名、可排序、不可删**；颜色与色槽固定。
自定义品类可增删改，最多 **4 个**（色槽 4~7，用完了就不能再建）。
删除自定义品类时，引用它的历史记录**迁到「其他」**。

#### 4.3.1 `GET /api/shapes` — 列出全部品类

**鉴权**：需要。**入参**：无。

**出参** `data`：数组，元素为 **ShapeVo**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 品类 id |
| `name` | string | 品类名 |
| `icon` | string | emoji 图标（SVG 加载失败时的兜底） |
| `iconPath` | string | SVG 图标路径。有则**优先用 svg** |
| `color` | string | 主题色，形如 `#EB6834` |
| `slot` | int | 色槽 0~7，决定图表配色 |
| `defaultPrice` | number | 默认单价，可为 `null` |
| `builtin` | boolean | 是否内置 |
| `used` | int | 用这个品类的记录累计数量 |

**错误码**：`401` 未登录。

---

#### 4.3.2 `POST /api/shapes` — 新建自定义品类

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 校验 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | string | 是 | 非空，≤ 20 字 | 品类名 |
| `icon` | string | 否 | ≤ 8 字符 | emoji 图标。留空用 `🎨` |
| `iconPath` | string | 否 | ≤ 200 字符 | SVG 图标路径。留空表示用 emoji |
| `color` | string | 否 | ≤ 9 字符 | 主题色，形如 `#RRGGBB`。留空则用该色槽对应的调色板色 |
| `defaultPrice` | number | 否 | ≥ 0 | 默认单价 |

> **色槽由服务端分配**：服务端在扩展槽 4~7 里挑**第一个没被占用的**给这个新品类，
> 挑不到就报「自定义品类最多 4 个」。**不复用已占用的槽**——复用会让某个品类的颜色
> 随别人增删而变。所以契约里**没有 `slot` 这个入参**，颜色以服务端返回的为准。

**出参** `data`：ShapeVo（同 4.3.1）。

**错误码**：`400` 名称为空/超长、色槽越界、自定义品类已满 4 个；`401` 未登录。

---

#### 4.3.3 `PUT /api/shapes/{id}` — 修改品类

**鉴权**：需要。

**入参**：路径参数 `id`；body 同 4.3.2。
**内置品类只能改 `name` 与 `icon`/`iconPath`，`color` 与 `slot` 固定。**

**出参** `data`：ShapeVo。

**错误码**：`400` 参数不合法；`401` 未登录；`404` 品类不存在。

---

#### 4.3.4 `DELETE /api/shapes/{id}` — 删除自定义品类

**用途**：删掉自定义品类，引用它的历史记录迁到「其他」。
**鉴权**：需要。

**入参**：路径参数 `id`。无 body。

**出参** `data`：`null`。

**错误码**：`400` 内置品类不可删；`401` 未登录；`404` 品类不存在。

---

#### 4.3.5 `POST /api/shapes/reorder` — 调整品类顺序

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ids` | string[] | 是 | 有序的品类 id 列表，**按数组顺序重排** |

**出参** `data`：`null`。

> 内置品类也可以参与排序。

**错误码**：`401` 未登录。
（传空数组当前**不报错**，直接返回成功且不改任何顺序。）

---

### 4.4 标签

内置标签**不可删**，可改名改色；自定义标签可增删改。

#### 4.4.1 `GET /api/tags` — 列出全部标签

**鉴权**：需要。**入参**：无。

**出参** `data`：数组，元素为 **TagVo**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 标签 id |
| `name` | string | 标签名 |
| `color` | string | 主题色，形如 `#RRGGBB` |
| `builtin` | boolean | 是否内置。内置的不可删 |
| `used` | int | 用这个标签的记录条数 |

**错误码**：`401` 未登录。

---

#### 4.4.2 `POST /api/tags` — 新建标签

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 校验 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | string | 是 | 非空，≤ 20 字 | 标签名 |
| `color` | string | 否 | ≤ 9 字符 | 主题色，形如 `#RRGGBB`。留空用 `#898781` |

**出参** `data`：TagVo。

**错误码**：`400` 名称为空/超长；`401` 未登录。

---

#### 4.4.3 `PUT /api/tags/{id}` — 修改标签

**鉴权**：需要。**入参**：路径参数 `id`；body 同 4.4.2。
**出参** `data`：TagVo。

**错误码**：`400` 参数不合法；`401` 未登录；`404` 标签不存在。

---

#### 4.4.4 `DELETE /api/tags/{id}` — 删除标签

**鉴权**：需要。**入参**：路径参数 `id`。无 body。**出参** `data`：`null`。

**错误码**：`400` 内置标签不可删；`401` 未登录；`404` 标签不存在。

---

### 4.5 售出

售出记录是**追加型，只增不改**（PRD §6.3）：金额已经进过报表，改写会让历史失真。
要改就删掉再记一条。

#### 4.5.1 `GET /api/sales` — 列出售出记录

**鉴权**：需要。

**入参**（query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `checkInId` | string | 否 | 只看某条打卡记录下的售出。不传 = 全部 |

**出参** `data`：数组，元素为 **SaleVo**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 售出记录 id，形如 `sale_xxx` |
| `checkInId` | string | 关联的打卡记录 id |
| `quantity` | int | 数量 |
| `unitPrice` | number | 单价 |
| `totalAmount` | number | 总额 = `unitPrice × quantity`（服务端算，不采信客户端） |
| `soldDate` | string | 售出日期 `YYYY-MM-DD`。**营收按这个日期归属** |
| `channel` | string | 销售渠道，留空时服务端记为 `other` |
| `note` | string | 备注 |
| `createdAt` | string | 创建时间，ISO-8601 |

排序：按 `soldDate` 倒序，同日按 `createdAt` 倒序。

**错误码**：`401` 未登录。

---

#### 4.5.2 `POST /api/sales` — 新增售出记录

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 校验 | 说明 |
| --- | --- | --- | --- | --- |
| `checkInId` | string | 是 | 非空 | 关联的打卡记录 id |
| `quantity` | int | 是 | 1 ~ 999 | 售出数量，**不能超过该条记录的未售出数量** |
| `unitPrice` | number | 是 | ≥ 0 | 单价 |
| `soldDate` | string | 是 | 不能是未来日期 | 售出日期 |
| `channel` | string | 否 | ≤ 20 字符 | 销售渠道 |
| `note` | string | 否 | ≤ 100 字 | 备注 |

**出参** `data`：SaleVo。

**错误码**：`400`「不能超过未售出数量（这条记录还剩 N 个）」/「不能记录未来的售出日期」；
`401` 未登录；`404` 关联的打卡记录不存在。

---

#### 4.5.3 `DELETE /api/sales/{id}` — 撤掉一条售出记录

**用途**：撤单。**软删除**，保留痕迹，库存与营收随之回滚。
**鉴权**：需要。**入参**：路径参数 `id`。无 body。**出参** `data`：`null`。

**错误码**：`401` 未登录；`404` 售出记录不存在。

---

### 4.6 回收站

软删除的记录在这里保留 **30 天**，到期自动物理删除；用户也可以提前彻底删除。

#### 4.6.1 `GET /api/trash` — 回收站列表

**鉴权**：需要。**入参**：无。

**出参** `data`：数组，元素为 **TrashVo**（打卡记录 + 素材混在一起，按删除时间倒序）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entityType` | string | `'check_in'` 或 `'material'` |
| `id` | string | 记录 id |
| `title` | string | 展示用标题（打卡是品类名，素材是素材名） |
| `subtitle` | string | 补充说明（打卡是「× N」，素材是备注） |
| `cover` | string | 封面图，**只有素材才有**；打卡是空串 |
| `sortDate` | string | 排序用日期（打卡用打卡日，素材用创建日） |
| `deletedAt` | string | 删除时间，ISO-8601 |
| `daysAgo` | int | 已经过了几天（按 UTC 算） |

**错误码**：`401` 未登录。

---

#### 4.6.2 `DELETE /api/trash` — 彻底删除一条

**用途**：不可恢复地删掉回收站里的一条。
**鉴权**：需要。

**入参**（query，**都在 query 上，不在 body**）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `entityType` | string | 是 | `'check_in'` 或 `'material'` |
| `id` | string | 是 | 记录 id |

**出参** `data`：`null`。

**错误码**：`400` `entityType` 非法；`401` 未登录；`404` 条目不存在。

---

#### 4.6.3 `DELETE /api/trash/all` — 清空回收站

**鉴权**：需要。**入参**：无。**出参** `data`：`null`。

**错误码**：`401` 未登录。

---

### 4.7 素材库

只有**一层**文件夹。删文件夹**不删素材**，素材转「未分类」（`folderId` 为空）。

#### 4.7.1 `GET /api/material/folder` — 文件夹列表

**鉴权**：需要。**入参**：无。

**出参** `data`：数组，元素为文件夹对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 文件夹 id，形如 `mf_xxx` |
| `name` | string | 文件夹名 |
| `coverMaterialId` | string | 封面素材 id |
| `sort` | int | 排序 |
| `createdAt` | string | 创建时间，ISO-8601 |
| `updatedAt` | string | 更新时间，ISO-8601 |

**错误码**：`401` 未登录。

---

#### 4.7.2 `POST /api/material/folder` — 新建文件夹

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 否 | 客户端生成的主键，形如 `mf_xxx`。留空则服务端生成 |
| `name` | string | 是 | 文件夹名 |
| `sort` | int | 否 | 排序 |
| `coverMaterialId` | string | 否 | 封面素材 id |

**出参** `data`：**FolderDto**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 文件夹 id |
| `name` | string | 文件夹名 |
| `sort` | int | 排序 |
| `coverMaterialId` | string | 封面素材 id |
| `updatedAt` | string | 更新时间，ISO-8601 |

**错误码**：`400` 参数不合法；`401` 未登录。

---

#### 4.7.3 `PUT /api/material/folder/{id}` — 文件夹改名

**鉴权**：需要。

**入参**：路径参数 `id`；body `{ "name": "新名字" }`（**只有 `name` 有效**）。

**出参** `data`：FolderDto。

**错误码**：`400` 参数不合法；`401` 未登录；`404` 文件夹不存在。

---

#### 4.7.4 `POST /api/material/folder/reorder` — 调整文件夹顺序

**鉴权**：需要。

**入参**（JSON body）：`{ "ids": ["mf_1", "mf_2"] }`（**按数组顺序重排**）。

**出参** `data`：`null`。

**错误码**：`401` 未登录。
（传空数组当前**不报错**，直接返回成功且不改任何顺序。）

---

#### 4.7.5 `DELETE /api/material/folder/{id}` — 删除文件夹

**用途**：删掉文件夹。**素材不删**，全部转「未分类」。
**鉴权**：需要。**入参**：路径参数 `id`。无 body。**出参** `data`：`null`。

**错误码**：`401` 未登录；`404` 文件夹不存在。

---

#### 4.7.6 `GET /api/material` — 素材列表

**鉴权**：需要。

**入参**（query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `folderId` | string | 否 | 筛选文件夹。**不传 = 全部素材**；**空串 = 只看未分类**；传 id = 该文件夹 |

**出参** `data`：数组，元素为素材对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 素材 id，形如 `mt_xxx` |
| `folderId` | string | 所属文件夹，**`null` = 未分类** |
| `url` | string | 图片地址 |
| `localPath` | string | 仅客户端有意义的本地路径 |
| `name` | string | 名称 |
| `note` | string | 备注 |
| `createdAt` | string | 创建时间，ISO-8601 |
| `updatedAt` | string | 更新时间，ISO-8601 |

> **`folderId` 的三种取值**：不传 / `null` = 全部素材；空串 = **只查未分类**；
> 具体 id = 该文件夹下的素材。

**错误码**：`401` 未登录。

---

#### 4.7.7 `POST /api/material` — 新增素材

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 否 | 客户端生成的主键，形如 `mt_xxx`。留空则服务端生成 |
| `folderId` | string | 否 | 所属文件夹，留空 / `null` = 未分类 |
| `url` | string | 是 | 图片地址 |
| `localPath` | string | 否 | 仅客户端有意义的本地路径 |
| `name` | string | 否 | 名称 |
| `note` | string | 否 | 备注 |

**出参** `data`：**MaterialDto**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 素材 id |
| `folderId` | string | 所属文件夹，`null` = 未分类 |
| `url` | string | 图片地址 |
| `localPath` | string | 本地路径 |
| `name` | string | 名称 |
| `note` | string | 备注 |
| `updatedAt` | string | 更新时间，ISO-8601 |

**错误码**：`400` 参数不合法；`401` 未登录。

---

#### 4.7.8 `PUT /api/material/{id}` — 修改素材

**用途**：改名称 / 备注 / 所属文件夹。
**鉴权**：需要。**入参**：路径参数 `id`；body 同 4.7.7。
**出参** `data`：MaterialDto。

> **只有 `name`、`note`、`folderId` 三个字段会被改。**
> `url` / `localPath` 是当初选图时就定下的，接口**不会**更新它们——
> 传了也白传（要换图请删掉重建）。

**错误码**：`400` 参数不合法；`401` 未登录；`404` 素材不存在。

---

#### 4.7.9 `DELETE /api/material/{id}` — 删除素材

**用途**：**软删除**（30 天回收站），跟打卡记录一个待遇。
**鉴权**：需要。**入参**：路径参数 `id`。无 body。**出参** `data`：`null`。

**错误码**：`401` 未登录；`404` 素材不存在。

---

### 4.8 统计

口径与前端 `utils/stat.js` 一致：

- **产量按打卡日归属**（一月做、五月卖 → 算一月的产量）
- **营收按售出日归属**
- **日均 = 产量 ÷ 有记录的天数**（不是 ÷ 全年天数）。UI 要写清楚这个口径
- **累计产量 = Σ check_in.count**，**未售出 = 累计产量 − 售出数量**
- 售出数量超过产量时（跨年卖出或记录被删），库存按 **0** 显示，并由 `oversold` 标志提醒，不要显示负数

#### 4.8.1 `GET /api/stats/year` — 年度总览

**鉴权**：需要。

**入参**（query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `year` | int | 是 | 年份，如 `2026` |

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 年份 |
| `production` | long | 累计产量 |
| `recordCount` | long | 打卡条数 |
| `activeDays` | long | 有记录的天数 |
| `avgPerDay` | number | 日均产出 = 产量 ÷ 有记录天数 |
| `revenue` | number | 营收 |
| `soldCount` | long | 售出数量 |
| `unsold` | long | 未售出数量，**负数已按 0 处理** |
| `oversold` | int | `1` = 售出数超过产量（跨年卖出或记录被删），否则 `0` |
| `avgPrice` | number | 单件均价 |

> **该年无记录时返回全 0，不是 404。**

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.2 `GET /api/stats/compare` — 跨年对比

**用途**：与上一年比产量。
**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 当年 |
| `previousYear` | int | 上一年 |
| `current` | long | 当年产量 |
| `previous` | long | 上一年产量 |
| `delta` | long | 差值 = 当年 − 上一年 |
| `rate` | number | 变化百分比（一位小数）。**上一年没记录时为 `null`**——没有基数就不给百分比 |
| `hasPrevious` | boolean | 上一年有没有记录 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.3 `GET /api/stats/monthly-production` — 按月的产量

**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 年份 |
| `month` | int | 月份 1~12 |
| `production` | long | 当月产量 |
| `activeDays` | long | 当月有记录的天数 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.4 `GET /api/stats/monthly-revenue` — 按月的营收

**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 年份 |
| `month` | int | 月份 1~12 |
| `revenue` | number | 当月营收 |
| `soldCount` | long | 当月售出数量 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.5 `GET /api/stats/shapes` — 造型分布

**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 年份 |
| `shapeId` | string | 分类 id |
| `shapeName` | string | 分类名 |
| `shapeIcon` | string | 图标 |
| `shapeColor` | string | 主题色 |
| `shapeSlot` | int | 色槽位 |
| `production` | long | 产量 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.6 `GET /api/stats/shape-revenue` — 按造型的结缘金

**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | int | 年份 |
| `shapeId` | string | 分类 id |
| `shapeName` | string | 分类名 |
| `shapeColor` | string | 主题色 |
| `revenue` | number | 结缘金 |
| `soldCount` | long | 售出数量 |
| `avgPrice` | number | 单件均价 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.7 `GET /api/stats/channel-revenue` — 按渠道的结缘金

**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `channel` | string | 渠道 id（留空时服务端记为 `other`） |
| `revenue` | number | 结缘金 |
| `soldCount` | long | 售出数量 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

#### 4.8.8 `GET /api/stats/inventory` — 库存

**用途**：累计口径，**跨年结转**（今年做的没卖完，明年还在库存里）。
**鉴权**：需要。**入参**：无。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `shapeId` | string | 分类 id |
| `shapeName` | string | 分类名 |
| `shapeColor` | string | 主题色 |
| `made` | long | 累计做了 |
| `sold` | long | 累计卖了 |
| `stock` | long | 剩余库存 |

**错误码**：`401` 未登录。

---

#### 4.8.9 `GET /api/stats/daily` — 逐日产量

**用途**：日历热力图。
**鉴权**：需要。**入参**（query）：`year`（int，**必填**）。

**出参** `data`：数组

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | string | 日期 `YYYY-MM-DD` |
| `production` | long | 当日产量 |

**错误码**：`400` `year` 缺失或非法；`401` 未登录。

---

### 4.9 同步

同步是「本地优先 + 云端补齐」的一条通道：本地先写成功，再往云端推。
合并策略是**字段级合并、后写覆盖先写**，判定依据是**客户端的 `updatedAt`**，不是服务端时钟。

#### 4.9.1 `POST /api/sync/push` — 推送本地变更

**鉴权**：需要。

**入参**（JSON body）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `deviceId` | string | 否 | 设备标识，服务端据此登记设备 |
| `checkIns` | object[] | 否 | 打卡记录数组，元素为 CheckInDto |
| `sales` | object[] | 否 | 售出记录数组，元素为 SaleDto |
| `photos` | object[] | 否 | 照片数组，元素为 PhotoDto |
| `folders` | object[] | 否 | 素材文件夹数组，元素为 FolderDto |
| `materials` | object[] | 否 | 素材数组，元素为 MaterialDto |
| `shapes` | object[] | 否 | 造型分类数组，元素为 ShapeDto |
| `tags` | object[] | 否 | 标签数组，元素为 TagDto |

同步协议里的元素形状：

- **CheckInDto**：`id, date, shapeId, count, note, durationMin, coverPhotoId, tagIds[], photos[], sales[], deleted, updatedAt, deletedAt`
- **SaleDto**：`id, checkInId, quantity, unitPrice, soldDate, channel, note, updatedAt`
- **PhotoDto**：`id, url, localPath, width, height, sort, updatedAt, checkInId`
- **FolderDto**：`id, name, sort, coverMaterialId, updatedAt`
- **MaterialDto**：`id, folderId, url, localPath, name, note, updatedAt`
- **ShapeDto**：`id, name, icon, iconPath, color, slot, defaultPrice, sort, isBuiltin`
- **TagDto**：`id, name, color, isBuiltin`

> `id` 留空时服务端补一个（`ci_`/`ph_`/`sale_`/`mf_`/`mt_` 前缀）。
> `isBuiltin` 是 `1`/`0` 的数字，不是布尔。

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `checkIns` | int | 已处理的打卡记录条数 |
| `photos` | int | 已处理的照片条数 |
| `sales` | int | 已处理的售出记录条数 |
| `folders` | int | 已处理的文件夹条数 |
| `materials` | int | 已处理的素材条数 |
| `serverTime` | string | 服务端时间，ISO-8601 |

**错误码**：`400` 参数不合法；`401` 未登录。

---

#### 4.9.2 `GET /api/sync/pull` — 拉取增量变更

**用途**：拉 `updatedAt` 之后有变动的记录。**软删除的墓碑也要拉走**，否则删除动作同步不过去。
**鉴权**：需要。

**入参**（query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `since` | string | 否 | ISO-8601 时间，只拉这之后变过的。不传 = 全量 |

**出参** `data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `serverTime` | string | 服务端时间，ISO-8601，可作为下次的游标 |
| `checkIns` | CheckInDto[] | 增量打卡记录 |
| `sales` | SaleDto[] | 增量售出记录 |
| `photos` | PhotoDto[] | 增量照片 |
| `folders` | FolderDto[] | 增量素材文件夹 |
| `materials` | MaterialDto[] | 增量素材 |
| `shapes` | ShapeDto[] | 造型分类（全量，按 `sort` 排序） |
| `tags` | TagDto[] | 标签（全量） |

**错误码**：`400` `since` 格式不合法；`401` 未登录。

---

## 5. 接入示例

### 5.1 原生 fetch

```js
// —— 只改这一行就能对接别的后端 ——
const BASE_URL = 'http://127.0.0.1:8080';
const TOKEN_KEY = 'nietu_daka_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 服务端恒返回 200，但代理/网关可能不是，这里兜一层
  const payload = await res.json().catch(() => null);
  if (!payload) throw { code: -1, message: `HTTP ${res.status}` };

  if (payload.code !== 0) {
    if (payload.code === 401) localStorage.removeItem(TOKEN_KEY); // 登录过期，清干净
    throw { code: payload.code, message: payload.message };
  }
  return payload.data;
}

// 1) 登录
const { token, account, mock } = await request('POST', '/api/login', {
  body: { code: wxLoginCode, nickname: '捏土的人', avatarUrl: 'https://...' },
});
localStorage.setItem(TOKEN_KEY, token);
if (mock) console.warn('后端处于 mock 模式，openid 不是真实微信号');

// 2) 带 token 请求
const page = await request('GET', '/api/checkin', {
  query: { year: 2026, page: 1, size: 20 },
});
console.log(page.records.length, page.total);

// 3) 处理业务错误
try {
  await request('POST', '/api/sales', {
    body: { checkInId: 'ci_xxx', quantity: 99, unitPrice: 30, soldDate: '2026-03-10' },
  });
} catch (err) {
  if (err.code === 400) toast(err.message);      // 「不能超过未售出数量…」
  else if (err.code === 401) gotoLogin();
  else toast('出错了，稍后再试');
}
```

### 5.2 axios

```js
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8080';
const TOKEN_KEY = 'nietu_daka_token';

const http = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data;                     // { code, message, data }
    if (body.code === 0) return body.data;
    if (body.code === 401) localStorage.removeItem(TOKEN_KEY);
    return Promise.reject({ code: body.code, message: body.message });
  },
  (err) => Promise.reject({ code: -1, message: err.message })  // 网络层错误
);

// 用起来就跟普通 axios 一样，data 已经被剥掉了
const shapes = await http.get('/api/shapes');
await http.post('/api/checkin', { date: '2026-03-10', shapeId: 'shape_ob11', count: 3 });
```

---

## 6. 注意事项

### 6.1 软删除

- 删除一律是**软删除**：服务端打 `deleted_at` 墓碑，30 天内可从回收站恢复，
  统计**立刻**回滚（删除时回滚、恢复时再回滚）
- 同步协议里，客户端发 `deleted: true` **或** `deletedAt` 非空，**任一成立即视为删除**
- 客户端要往服务端推墓碑时，`deletedAt` 传非空字符串即可

### 6.2 主键由客户端生成

各实体的主键**由客户端生成**，服务端按主键 upsert，所以**写入天然幂等**——
同样的数据推两次不会产生两条记录，重试安全的。

| 实体 | 主键前缀 | 例子 |
| --- | --- | --- |
| 打卡记录 | `ci_` | `ci_xxx` |
| 照片 | `ph_` | `ph_xxx` |
| 售出记录 | `sale_` | `sale_xxx` |
| 素材 | `mt_` | `mt_xxx` |
| 素材文件夹 | `mf_` | `mf_xxx` |
| 品类 | `shape_` | `shape_xxx`（内置的四个是 `shape_ob11` / `shape_qq` / `shape_zhengbi` / `shape_other`） |
| 标签 | `tag_` | `tag_xxx` |

留空时服务端会补一个。

### 6.3 时间

- 一律 **UTC**。服务端按 UTC 存和比，客户端也发 UTC 的 ISO-8601 串
- **禁止裸毫秒时间戳**
- 合并「后写覆盖先写」用的是**客户端的 `updatedAt`**——用服务端时钟的话每次推送都会赢，
  旧版本客户端的数据就再也传不上去了

### 6.4 领域规则（最容易做错的几条）

1. **产量按打卡日归属，营收按售出日归属**。一月做、五月卖 → 一月的产量 + 五月的营收，
   两个聚合的 key 本来就不同，不是 bug
2. **累计产量 ≠ 售出数量**。`累计产量 = Σ check_in.count`，
   `未售出 = 累计产量 − 售出数量`。售出数超过产量时（跨年卖出、记录被删），
   库存显示 **0** 并给警告，**不要显示负数**
3. **售出数量不能超过该条记录的未售出数量**。这条约束**服务端会兜住**（返回 400），
   前端表单也要限制
4. **日均除以「有记录的天数」**，不是全年天数。UI 上要写明口径
5. **售出记录只增不改**，要改就删掉重记
6. **删文件夹不删素材**，素材转「未分类」（`folderId` 为空）
7. **内置品类/标签不可删**：内置品类（OB11娃头 / QQ人 / 正比 / 其他）可改名可排序，
   内置标签可改名改色

### 6.5 隐私

- 未登录时前端**不显示**任何用户内容（计数、记录、作品、素材、品类、标签一律按空渲染，
   显示「登录后可见」），但**不拦截**：没有全屏登录页、没有强制跳转、没有遮罩
- 打卡需要登录：点「去打卡」直接跳登录页，登录完**接着回到打卡页**
- 退出登录**不删本地记录**，只是把它们藏起来；只有「注销账号」才清两边

### 6.6 未知字段

- 前端多传字段**不该 500**，所有 DTO 都是 `@JsonIgnoreProperties(ignoreUnknown = true)`
- 前端少传可选字段也是安全的

### 6.7 跨域

服务端已开 CORS（`allowedOriginPatterns("*")`），浏览器直连不需要额外代理。
本地调试要点：

- 微信开发者工具要勾「不校验合法域名…」才能连本机
- **模拟器里 `127.0.0.1` 是你的电脑；真机预览时 `127.0.0.1` 指的是手机自己**，
  真机要换成电脑的局域网 IP（`ipconfig` 看 IPv4）

# 捏土打卡 · 服务端

微信小程序「捏土打卡」的 API 服务。为 `001/`（小程序前端）提供登录、数据同步、统计与素材库接口。

## 技术栈

| 项 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Spring Boot 3.5.4 | 主流基线 |
| JDK | 21 | 虚拟线程（Loom）转正，同步 IO 高并发划算 |
| 持久层 | MyBatis-Plus 3.5.9 | 统计口径走数据库视图，ORM 不硬扛复杂 SQL |
| 数据库 | MySQL 8.0 | 表与视图见 `../004数据库脚本/` |
| 鉴权 | 自签 JWT (jjwt 0.12.6) | 只放 openid，服务端按 openid 过滤数据 |
| 文档 | SpringDoc 2.8.6 | Swagger UI：`/swagger-ui.html` |
| 构建 | Maven 3.9 | `mvn clean package` |
| 交付 | Docker + docker-compose | 镜像只带 JRE |

## 快速开始

### 1. 准备数据库

```bash
MYSQL="/d/Program Files/MySQL/MySQL Server 8.0/bin/mysql"
"$MYSQL" -u root -p < ../004数据库脚本/001_schema.sql
"$MYSQL" -u root -p < ../004数据库脚本/003_views.sql
```

### 2. 配置

**本机数据库密码**放在 `src/main/resources/application-local.yml`（已被 `.gitignore` 忽略，不入库）。
新克隆先从模板复制一份：

```bash
cp src/main/resources/application-local.template.yml src/main/resources/application-local.yml
# 然后把 password 改成你本机的 MySQL 密码
```

其余敏感项走环境变量：

| 环境变量 | 说明 | 默认 |
| --- | --- | --- |
| `APP_JWT_SECRET` | JWT 签名密钥，**至少 32 字节** | 占位值，生产必须覆盖 |
| `WECHAT_APP_ID` / `WECHAT_SECRET` | 小程序凭据，用于 code 换 openid | 空 |
| `WECHAT_MOCK` | `true` 时用 md5(code) 当 openid，仅本地联调 | `false` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | 数据库连接 | 见 `application.yml` |

> `app.jwt.secret` 不足 32 字节时服务**启动即失败**——这是有意的，避免用弱密钥上线。

### 3. 接真实微信号（本地 mock 与真实账号的区别）

后端在**没配小程序 AppSecret** 时会自动降级为 **mock 模式**：用 `md5(code)` 当 openid。
所以：

- 数据库里能看到 `mock_xxxx` 开头的账号，**但那不是你的真实微信号**
- 登录与资料接口都会返回 `mock: true`，小程序会把它显示出来
- **微信昵称后端拿不到**——`code2session` 只返回 `openid` / `session_key` / `unionid`，
  没有昵称。昵称只能由用户在小程序的 `<input type="nickname">` 里点一下授权，
  前端会把它随登录请求一起发过来

**换成真实账号，只要填一个值：AppSecret。**

AppID 后端会自己从 `001/project.config.json` 里读，所以后端和小程序**永远是同一个
AppID**——两边不一致正是微信返回 `40029 invalid code` 的头号原因。

1. **确认小程序有真实 AppID。** `001/project.config.json` 的 `appid` 要是
   微信公众平台上的真实 AppID（`touristappid` 是游客 AppID，换不到 openid）。
   这个文件已 gitignore，不会入库。
2. **填 AppSecret。** 微信公众平台 → 开发管理 → 开发设置 → AppSecret，
   写进本机私有配置（已 gitignore）：

   ```yaml
   # 005.后端代码/src/main/resources/application-local.yml
   app:
     wechat:
       secret: 你的AppSecret
   ```

   首次配置先从模板复制：`cp src/main/resources/application-local.template.yml src/main/resources/application-local.yml`
3. **重启后端。** 启动日志会打印「已配置 AppID xxx 与 AppSecret，将使用真实的
   jscode2session」；登录一次，数据库里就会出现你的真实 openid，
   小程序里的「本地联调模式」提示随之消失。

> AppSecret 等同于密码，不要提交进仓库、也不要用微信官方文档以外的渠道传递。
> 生产环境用 `WECHAT_SECRET` 环境变量注入，并确保 `app.wechat.require-credentials=true`
> （`prod` profile 已默认开启）——线上不容许悄悄用假 openid 建号。

### 3. 跑起来

```bash
export JAVA_HOME=/d/work/software/jdk-21
export PATH=$JAVA_HOME/bin:$PATH

mvn spring-boot:run
```

Windows Git Bash 同理（把 `JAVA_HOME` 设成 `D:\work\software\jdk-21`）。

默认激活 `dev,local` 两个 profile（假 code2session + 本机数据库密码）。
上线用 `SPRING_PROFILES_ACTIVE=prod` 覆盖，**不要带 local**。

| profile | 作用 |
| --- | --- |
| `dev` | 假 code2session（`md5(code)` 当 openid）+ debug 日志 |
| `local` | 本机数据库密码，来自 gitignore 的 `application-local.yml` |
| `prod` | 全部敏感项走环境变量 |

### 4. 用 Docker

```bash
export APP_JWT_SECRET=$(openssl rand -base64 48)
export DB_PASSWORD=你的数据库密码
docker compose up -d --build
```

`DB_PASSWORD` 是**必填**的：MySQL 容器把 3306 发布到宿主机，用弱默认密码等于把数据库暴露出去。

首次启动会自动执行 `../004数据库脚本/` 里的建表脚本（MySQL 容器初始化目录）。

## 接口一览

**完整契约见 [`docs/api.md`](docs/api.md)**（45 个接口的字段、校验、错误码）。
前端接入示例见 `003.前端代码/frontend/api/`（baseURL 只在一个地方，改端口只改那一行）。

所有接口除 `/api/login`、`/api/health` 外都要带 token：

```
Authorization: Bearer <token>
```

### 前后端契约（照着改，否则小程序会静默失败）

这几条是 `001/utils/auth.js` 和服务端之间实际生效的约定，改任何一边都要同步改另一边。

| 项 | 约定 | 踩过的坑 |
| --- | --- | --- |
| 响应包裹 | HTTP 200 + `{ code, message, data }`；`code !== 0` 是业务失败 | 前端早期把 `code !== 0` 当成功，错误被吞掉 |
| token 位置 | **只在 `Authorization` 头**，不放 body | 放 body 后拦截器拿不到 |
| 登录返回 | `{ token, account: { openid, unionid, nickname, avatarUrl, createdAt }, newUser, expireSeconds, mock }` | 早期返回的是扁平字段，前端读 `res.account` 拿到 undefined |
| 时间格式 | 一律 **ISO-8601 带 `Z`**（`2026-11-01T02:23:11.170Z`） | 不带 `Z` 的话 JS 端 `new Date()` 会按本地时间解析，差 8 小时 |
| 时区 | 服务端 JVM 与 Jackson 都固定 **UTC** | 本地时区会让「今天」跨天错位 |
| 未知字段 | 请求 DTO 一律 `@JsonIgnoreProperties(ignoreUnknown = true)` | 前端多发一个字段就 500 |
| 软删除 | 客户端发 `deleted: true` **或** `deletedAt` 非空，任一成立即视为删除 | 两个字段名都出现过，得都认 |
| 出参不是 Entity | 一律走 VO（`CheckInVo` / `ShapeVo` …） | 直接返回 Entity，数据库加字段就等于接口变更 |
| 复合主键的查询 | 任何按 id 的查询都要**同时带 openid** | `updateById` 只按 `id` 匹配，会改到别人账号的数据 |

服务端的 `LoginRequest` / `SyncPushRequest` 等 DTO 上都加了 `ignoreUnknown`，
所以前端临时多传字段不会打挂服务——但字段名本身必须对得上。

### 账号

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 探活，免鉴权。小程序用它判断「后端到底通不通」 |
| POST | `/api/login` | 微信一键登录，首次登录自动注册，返回 token |
| GET | `/api/profile` | 当前账号资料 |
| POST | `/api/profile` | 改昵称头像 |
| POST | `/api/account/delete` | 注销账号并清除该账号全部数据 |

### 同步

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/sync/push` | 推送本地变更（字段级合并，后写覆盖先写） |
| GET | `/api/sync/pull?since=` | 拉取增量变更 |

### 打卡

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/checkin?year=&shapeId=&page=&size=` | 分页查询（出参 `CheckInVo`，带品类名与售出数） |
| POST | `/api/checkin` | 新建 |
| PUT | `/api/checkin/{id}` | 修改 |
| DELETE | `/api/checkin/{id}` | 软删除（进 30 天回收站） |
| POST | `/api/checkin/{id}/restore` | 从回收站恢复 |

### 品类（造型）

内置四个可改名、可排序、**不可删**；自定义品类可增删改删，最多 4 个。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/shapes` | 品类列表（带每个品类的累计用量） |
| POST | `/api/shapes` | 新建自定义品类（色槽由服务端分配，不循环） |
| PUT | `/api/shapes/{id}` | 修改（内置的只能改名称与图标） |
| DELETE | `/api/shapes/{id}` | 删自定义品类（历史记录迁到「其他」） |
| POST | `/api/shapes/reorder` | 调整顺序 |

### 标签

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/tags` | 标签列表（带引用条数） |
| POST | `/api/tags` | 新建 |
| PUT | `/api/tags/{id}` | 修改 |
| DELETE | `/api/tags/{id}` | 删除（内置的不可删） |

### 售出

**追加型，只增不改**：金额已经进过报表，改写会让历史失真。撤单就删掉再记一条。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sales?checkInId=` | 售出记录列表 |
| POST | `/api/sales` | 新增（数量不能超过未售出数量，超了 400） |
| DELETE | `/api/sales/{id}` | 撤单（软删除） |

### 回收站

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/trash` | 回收站列表（打卡记录 + 素材） |
| DELETE | `/api/trash?entityType=&id=` | 彻底删除一条 |
| DELETE | `/api/trash/all` | 清空回收站 |

### 统计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stats/year?year=` | 年度总览：产量 / 营收 / 未售出 / 日均。**该年无记录返回全 0，不是 404** |
| GET | `/api/stats/compare?year=` | 跨年对比（与上一年比产量） |
| GET | `/api/stats/monthly-production?year=` | 按月产量 |
| GET | `/api/stats/monthly-revenue?year=` | 按月营收 |
| GET | `/api/stats/shapes?year=` | 造型分布 |
| GET | `/api/stats/shape-revenue?year=` | 按造型的结缘金 |
| GET | `/api/stats/channel-revenue` | 按渠道的结缘金 |
| GET | `/api/stats/inventory` | 库存（累计口径） |
| GET | `/api/stats/daily?year=` | 逐日产量（热力图） |

### 素材库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/material/folder` | 文件夹列表 |
| POST | `/api/material/folder` | 新建文件夹 |
| PUT | `/api/material/folder/{id}` | 文件夹改名 |
| POST | `/api/material/folder/reorder` | 调整文件夹顺序 |
| DELETE | `/api/material/folder/{id}` | 删文件夹（素材转未分类，**不删素材**） |
| GET | `/api/material?folderId=` | 素材列表。不传 = 全部；**空串 = 只查未分类** |
| POST | `/api/material` | 新增素材 |
| PUT | `/api/material/{id}` | 改名称 / 备注 / 所属文件夹 |
| DELETE | `/api/material/{id}` | 软删除素材 |

## 几个关键设计

### 统计口径只有一份

所有统计接口都查 `../004数据库脚本/003_views.sql` 里的视图，不在 Java 里另写一遍 SQL。
**产量按打卡日归属、营收按售出日归属**——这两个归属键不同，是整个统计里最容易算错的地方，
视图把它们拆开了，年度总览视图才把它们并到一起。

服务端和前端 `001/utils/stat.js` 的 `yearlyOverview()` 是同一套定义。

### 同步的合并策略

- 主键由**客户端生成**（`ci_xxx` / `ph_xxx`），服务端不生成主键——离线产生的记录才能直接上传
- 打卡 / 照片 / 文件夹 / 素材：按 `updated_at` 做**字段级合并**，后写覆盖先写
- 售出记录：**追加型**，只插不改（金额已被统计进报表，覆盖会改历史）
- 软删除用 `deleted_at` 做墓碑，删除动作本身也要同步，否则另一台设备会把记录「复活」

### 数据隔离

复合主键 `(openid, id)`：内置造型的 id 对每个账号都是 `shape_ob11`，
单列主键会撞。所有查询都带 `openid`，token 里只有 openid，拿不到别人的数据。

## 测试

```bash
mvn test
```

`src/test/` 下有基于真实 MySQL 的集成测试，覆盖登录建号、种子数据、同步合并语义与统计口径。
测试跑 `dev,local` profile——**没配 `application-local.yml` 就连不上库**。

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

本地 `dev` profile 跑的是 **mock 模式**：没配 `WECHAT_APP_ID` / `WECHAT_SECRET` 时，
服务端用 `md5(code)` 当 openid。所以：

- 数据库里能看到 `mock_xxxx` 开头的账号，**但那不是你的真实微信号**
- 登录响应里的 `mock: true` 就是这个意思，小程序会把它显示出来
- **微信昵称后端拿不到**——`code2session` 只返回 `openid` / `session_key` / `unionid`，
  没有昵称。昵称只能由用户在小程序的 `<input type="nickname">` 里点一下授权，
  前端会把它随登录请求一起发过来

要换成真实账号，三步：

1. **小程序要有真实 AppID。** `001/project.config.json` 里现在是 `touristappid`
   （游客 AppID），它换不到 openid。去微信公众平台 → 开发管理 → 开发设置，
   拿到自己的 AppID 填进去（这个文件已 gitignore，不会入库）。
2. **后端拿到 AppID 与 Secret。** 同一页面的「AppSecret」，
   配成环境变量启动：

   ```bash
   export WECHAT_APP_ID=wx1234567890abcdef
   export WECHAT_SECRET=你的AppSecret
   export WECHAT_MOCK=false
   ```

   `WECHAT_MOCK=false` 是必须的——`dev` profile 默认把它打开，
   不关掉的话后端仍然会用假 openid。
3. **重启后端**。登录一次，数据库里就该出现你的真实 openid，
   且 `login` 响应里的 `mock` 变成 `false`。

> AppSecret 等同于密码，不要提交进仓库、也不要用微信官方文档以外的渠道传递。

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
| 登录返回 | `{ token, account: { openid, unionid, nickname, avatarUrl, createdAt }, newUser, expireSeconds }` | 早期返回的是扁平字段，前端读 `res.account` 拿到 undefined |
| 时间格式 | 一律 **ISO-8601 带时区**（`2026-11-01T02:23:11.170Z`） | 前端直接发裸毫秒数，Jackson 对 `LocalDateTime` 直接报错 |
| 时区 | 服务端 JVM 与 Jackson 都固定 **UTC**（`application.yml` 的 `time-zone` + `TimeZone.setDefault`） | 本地时区会让「今天」跨天错位 |
| 未知字段 | 请求 DTO 一律 `@JsonIgnoreProperties(ignoreUnknown = true)` | 前端多发一个字段就 500 |
| 软删除 | 客户端发 `deleted: true` **或** `deletedAt` 非空，任一成立即视为删除 | 两个字段名都出现过，得都认 |

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
| GET | `/api/checkin?year=&shapeId=&page=&size=` | 分页查询 |
| POST | `/api/checkin` | 新建 |
| PUT | `/api/checkin/{id}` | 修改 |
| DELETE | `/api/checkin/{id}` | 软删除（进 30 天回收站） |
| POST | `/api/checkin/{id}/restore` | 从回收站恢复 |

### 统计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stats/year?year=` | 年度总览：产量 / 营收 / 未售出 / 日均 |
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
| DELETE | `/api/material/folder/{id}` | 删文件夹（素材转未分类，**不删素材**） |
| GET | `/api/material?folderId=` | 素材列表 |
| POST | `/api/material` | 新增素材 |
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

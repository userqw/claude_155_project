# 捏土打卡 · Java 后端开发规范

> **适用范围**：`005.后端代码/` 及其后续所有 Java 服务
> **技术基线**：JDK 21 · Spring Boot 3.5 · MyBatis-Plus 3.5 · MySQL 8
> **文档定位**：这是**可执行的**规范，不是建议清单。每条规则都有编号，代码评审和 CI 都可以按编号引用。

---

## 0. 总则

### 0.1 规范的分级

| 级别 | 含义 | 不符合怎么办 |
| --- | --- | --- |
| **P0 强制** | 违反即视为缺陷 | 合并前必须改掉，评审直接打回 |
| **P1 应当** | 默认遵守，偏离要在 PR 里说明理由 | 评审时讨论 |
| **P2 建议** | 团队偏好，新代码照做 | 不阻塞 |

规则编号格式 `<域>-<序号>`，例如 `ERR-03`。评审意见直接写「违反 DB-07」，不用复述全文。

### 0.2 三条底线

1. **正确性 > 可读性 > 性能。** 任何优化都不能牺牲正确性；一次真实的线上事故抵得过十次微优化。
2. **显式优于隐式。** 时区、事务边界、字符集、幂等键——全部写出来，不靠"大家都这么写"。
3. **不确定就问，不要猜。** 规范解决的是共识问题，不是替人做决定。涉及业务语义的（金额口径、归属规则）一律找产品确认。

### 0.3 规范的执行

- 新增代码必须符合；存量代码**不要求立刻整改**，但**改动到哪一行，那一行就要符合**（改一行算一行，不搞整文件格式化）。
- 规范冲突时，优先级：**安全 > 数据正确性 > 可用性 > 性能 > 风格**。
- 想改规范，先改这份文档并提 PR，不要在代码里"事实上"改规矩。

---

## 1. 项目结构与分层

### ARCH-01 分层与依赖方向（P0）

```
Controller  →  Service  →  Mapper
     ↓            ↓
   DTO/VO      Entity
```

**依赖只能从上往下。** 反向依赖（同层互调、Mapper 调 Service）是 P0 违规。

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| `controller` | 参数校验、协议转换、鉴权入口 | 写业务逻辑、直接用 Mapper |
| `service` | 业务规则、事务边界、编排 | 直接碰 HTTP 语义（`HttpServletRequest`） |
| `mapper` | 数据存取 | 写业务判断 |
| `dto` / `vo` | 入参 / 出参 | 复用 Entity 当 DTO |
| `entity` | 数据库映射 | 出参直接序列化 |
| `common` | 跨模块的公共物（`Result`、`BizException`） | 放业务逻辑 |

### ARCH-02 业务逻辑不写在 Controller（P0）

```java
// ❌ 业务逻辑漏在 Controller 里，换个入口就得复制一遍
@PostMapping("/orders")
public Result<Order> create(@RequestBody @Valid CreateOrderRequest req) {
    if (req.getQuantity() <= 0) {
        throw new BizException("数量要大于 0");     // 这是校验，能接受
    }
    Order order = new Order();
    order.setUserId(currentUser().getId());
    order.setStatus(Status.PENDING);
    order.setAmount(req.getPrice() * req.getQuantity());   // ❌ 算价是业务
    orderMapper.insert(order);
    return Result.ok(order);
}

// ✅ 协议层只做协议层的事
@PostMapping("/orders")
public Result<OrderVO> create(@RequestBody @Valid CreateOrderRequest req) {
    return Result.ok(orderService.create(req));
}
```

**判断标准**：这段逻辑换个入口（定时任务、MQ 消费者）还需要吗？需要 → 它属于 Service。

### ARCH-03 一个 Service 只管一个聚合根（P1）

不要出现 `OrderService` 顺手改库存、改优惠券、改积分。跨聚合的编排放到一个专门的 `XxxFacade` / `XxxCoordinator` 里，名字要能体现"这是个编排器"。

### ARCH-04 Controller 保持薄（P1）

- 单个方法不超过 ~30 行，超过就是业务漏出来了。
- 一个 Controller 的方法数超过 15 个，拆类。

### ARCH-05 包名全小写、无下划线（P0）

`com.nietu.daka.service.checkin`，不是 `com.nietu.daka.service.CheckIn`。
包名一旦发布就不能改，改名 = 破坏所有下游的 import。

### ARCH-06 工具类放 `common.util`（P1）

不要在业务包下散落 `StringUtils`、`DateUtils`。工具类必须是**纯函数**、**无状态**、**可单测**。

---

## 2. 命名

### NAME-01 命名必须表达意图（P0）

```java
// ❌
int d;                    // d 是什么
List<Object> l;           // 装什么
public void proc() {}     // 做什么

// ✅
int unpaidAmount;         // 未付金额
List<CheckIn> pendingCheckIns;
public void settleOverdueOrders() {}
```

### NAME-02 缩写词的处理（P1）

- 通用缩写：`id` / `url` / `http` / `sql` / `json` / `dto` / `vo` **全小写**
- 业务缩写按词首大写：`QQ` 人 → `QQShape`，不是 `QqShape`；`OB11` → `Ob11Shape`
- 不用自造缩写：`UserInfo` 而不是 `UserInf`

### NAME-03 布尔值语义明确（P1）

用 `is` / `has` / `can` / `should` 前缀，**不要用否定式命名**：

```java
// ❌ 双重否定，调用处要读两遍
boolean isNotEmpty; boolean notDisabled;

// ✅
boolean isEmpty; boolean isEnabled;
```

### NAME-04 集合与单数（P1）

| 类型 | 命名 |
| --- | --- |
| 集合 | 复数：`List<CheckIn> checkIns` |
| 单个 | 单数：`CheckIn checkIn` |
| Map 的 key | `Map<String, CheckIn> checkInById`（说明按什么分的） |
| 布尔字段 | `is` / `has` / `can` 前缀 |

### NAME-05 领域词与 PRD 一致（P0）

类名、字段名、注释里的**领域词**必须与 PRD 相同。`check_in` / `photo` / `sale` / `shape` / `tag` / `openid` / `unionid` / `deleted_at` 这些词不要自行"优化"成同义词。

> 本项目实例：PRD 叫「品类」还是「造型」，代码与界面必须统一。改名要连 PRD 一起改，不能代码单方面换。

### NAME-06 常量全大写下划线（P0）

```java
private static final int MAX_RETRY_COUNT = 3;
private static final String TOKEN_HEADER = "Authorization";
```

集合常量用 `List.of(...)`，不要暴露可变的 `Arrays.asList` 结果。

### NAME-07 枚举带业务含义，不带魔法值（P0）

```java
// ❌
if (status == 1) { ... }

// ✅
public enum CheckInStatus {
    PENDING, PAID, CANCELLED
}
```

枚举的 `code` 要与数据库存的值一一对应，且**在代码里只有一处定义**——不允许 Controller、Service、Mapper 各写一个数字。

### NAME-08 包名体现领域而非技术（P1）

`service.checkin` 优于 `service.impl`；`adapter.wx` 优于 `util.wx`。

---

## 3. 格式与注释

### STYLE-01 基础格式（P1）

| 项 | 规定 |
| --- | --- |
| 缩进 | 4 空格，**不用 Tab** |
| 行宽 | 120 列 |
| 单方法长度 | ≤ 80 行；≥ 40 行必须拆 |
| 单文件长度 | ≤ 800 行；超过按领域拆类 |
| 嵌套深度 | ≤ 3 层 |
| `else` | 能不用就不用；连续 `if` 用卫语句提前返回 |
| 魔法值 | 一律提取为常量或枚举 |

IDE 配置（IntelliJ）：

```
Code Style > Java
  - Use tab character: OFF
  - Continuation indent: 4
  - Right margin: 120
  - Braces: Java style (K&R)
```

### STYLE-02 import 顺序（P1）

```
1. java.*
2. javax.* / jakarta.*
3. 第三方（org.springframework、com.baomidou…）
4. 项目自己的
5. 静态导入（static import）放最后
```

- **禁止** `import java.util.*` 通配符导入。
- **禁止** import 了却没用（IDE 自动优化掉，别手动留）。

### STYLE-03 注释写「为什么」，不写「是什么」（P0）

```java
// ❌ 复述代码
// 给 order 设置 status
order.setStatus(Status.PENDING);

// ✅ 解释为什么
// 下单即占用库存：库存要等到支付成功才真正扣减，
// 否则用户反复下单会把库存锁死（见 PRD §5.2 库存口径）
order.setStatus(Status.PENDING);
```

### STYLE-04 公共 API 必须有 Javadoc（P0）

- **类**：说明这个类解决什么问题、边界在哪。类注释里写清 `@author` 与 `@since`（或版本号）。
- **公共方法**：说明入参、返回值、抛出的异常、副作用。
- 明显的 getter/setter 不需要。

```java
/**
 * 打卡记录服务。
 *
 * <p>负责打卡记录的增删改查与售出数量的一致性维护。
 * 所有方法都以 openid 过滤数据，跨账号访问会被拒绝。
 *
 * @author 捏土打卡团队
 * @since 1.0
 */
@Service
public class CheckInService { }
```

### STYLE-05 TODO 必须带责任人与上下文（P1）

```java
// TODO(zhangsan, 2026-03-01): 支持批量导入，排期到 1.4 版本
```

禁止留裸的 `// TODO` 或 `// FIXME`。

### STYLE-06 注释与代码同步（P0）

改逻辑时必须一起改注释。**过期的注释比没有注释更危险**——它会骗过下一个读代码的人。

---

## 4. 日志

### LOG-01 用 SLF4J 参数化，不用字符串拼接（P0）

```java
// ❌ 拼接：即使日志级别关掉，字符串也已经拼好了
log.debug("用户 " + userId + " 登录失败，耗时 " + cost + "ms");

// ✅ 参数化：级别关掉时零开销
log.debug("用户 {} 登录失败，耗时 {}ms", userId, cost);
```

### LOG-02 禁止 `e.printStackTrace()`（P0）

```java
// ❌ 栈打到 stdout，进了容器就没了，也没法按级别过滤
e.printStackTrace();

// ✅
log.error("打卡保存失败, checkInId={}", checkInId, e);   // 异常放最后一个参数
```

### LOG-03 异常要么处理要么抛出，禁止吞掉（P0）

```java
// ❌ 吞掉：出错了没人知道
try {
    syncService.push(data);
} catch (Exception e) {
    // ignore
}

// ✅ 要么处理（重试/降级/补偿），要么原样抛出
try {
    syncService.push(data);
} catch (SyncException e) {
    log.warn("同步失败，已入重试队列, id={}", id, e);
    retryQueue.offer(data);
}
```

**空的 catch 块是 P0 违规**——即使写了注释说明为什么，也要用 `log.warn` 留痕。

### LOG-04 日志分级（P0）

| 级别 | 用于 |
| --- | --- |
| `ERROR` | 需要人介入的失败（数据写不进去、依赖不可用） |
| `WARN` | 降级了但还能跑（重试成功、走了兜底分支） |
| `INFO` | 关键业务节点（订单创建、登录成功、状态变更） |
| `DEBUG` | 排查用的上下文（入参摘要、命中缓存） |
| `TRACE` | 极少用，只在性能剖析时开 |

- **`ERROR` 必须能告警。** 一个没人看的 ERROR 日志等于没打。
- 生产环境默认 `INFO`；`DEBUG` 要能通过配置动态开。

### LOG-05 禁止打印敏感信息（P0）

```java
// ❌
log.info("用户登录, openid={}, sessionKey={}, phone={}", openid, sessionKey, phone);

// ✅
log.info("用户登录, openid={}", maskOpenid(openid));
```

**禁止进日志的**：密码、AppSecret、SessionKey、Token、身份证、银行卡、完整手机号。
手机号要打就打脱敏的：`138****8000`。

### LOG-06 日志要能定位问题（P1）

每条 `ERROR` 至少带上：操作对象 ID、当前用户 ID、关键参数、耗时。

```java
log.error("打卡保存失败, checkInId={}, userId={}, date={}, cost={}ms",
        checkInId, userId, date, cost, e);
```

### LOG-07 异常日志只打一次（P1）

底层 catch 打了 ERROR 并继续往上抛，上层又打一遍 → 同一个故障刷屏十几次。
**在哪层处理就在哪层打**，上层只做透传。

### LOG-08 不用 `System.out`（P0）

生产环境没有级别过滤、没有上下文、不能关。

---

## 5. 异常与错误码

### ERR-01 定义业务异常基类（P0）

```java
public class BizException extends RuntimeException {
    private final int code;

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    public int getCode() { return code; }

    // 常用语义的快捷构造
    public static BizException unauthorized(String message) {
        return new BizException(ResultCode.UNAUTHORIZED.code(), message);
    }
}
```

- **业务异常继承 `RuntimeException`**，不强制调用方声明 `throws`。
- **技术异常**（SQL 失败、网络超时）用原生异常，不要包成 `BizException`——它们不是"用户操作错了"。

### ERR-02 全局异常处理器统一出口（P0）

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BizException.class)
    public Result<Void> onBiz(BizException e, HttpServletRequest req) {
        log.warn("业务异常, uri={}, message={}", req.getRequestURI(), e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> onInvalid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst().orElse("参数不合法");
        return Result.fail(ResultCode.BAD_REQUEST, msg);
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> onOther(Exception e, HttpServletRequest req) {
        log.error("系统异常, uri={}", req.getRequestURI(), e);
        return Result.fail(ResultCode.INTERNAL_ERROR, "服务器开小差了");
    }
}
```

**兜底 handler 绝不能把内部异常信息吐给用户**（堆栈、SQL 语句、类名）。

### ERR-03 错误码分层且稳定（P0）

| 段位 | 含义 | 示例 |
| --- | --- | --- |
| `0` | 成功 | |
| `4xx` | 客户端错误 | `400` 参数不合法、`401` 未登录、`403` 无权、`404` 不存在 |
| `5xx` | 服务端错误 | `500` 内部错误 |

**错误码一经发布不可改含义**，只能新增。要改就是破坏契约。

### ERR-04 异常消息是给用户看的（P1）

```java
// ❌ 泄露实现
throw new BizException("SQL update failed: " + sql);

// ✅ 用户看得懂
throw new BizException("这条记录已被删除，无法重复操作");
```

### ERR-05 不要用异常做流程控制（P1）

"查不到就抛异常"在正常业务路径上非常常见（比如"查不到就当没有"）。
这种场景用返回值表达：

```java
// ❌ 用异常表达「查不到」是正常情况
Account account = accountMapper.selectById(id);   // 返回 null 是正常的

// ✅
Account account = accountMapper.selectById(id);
if (account == null) {
    throw new BizException(ResultCode.NOT_FOUND, "账号不存在");
}
```

### ERR-06 finally 里不吞异常（P0）

```java
// ❌
try {
    doSomething();
} finally {
    cleanup();     // cleanup 抛异常会盖掉原始异常
}

// ✅
try {
    doSomething();
} finally {
    try { cleanup(); } catch (Exception e) { log.warn("清理失败", e); }
}
```

---

## 6. 接口与数据契约

### API-01 统一响应体（P0）

```java
public record Result<T>(int code, String message, T data) {
    public static <T> Result<T> ok(T data) { return new Result<>(0, "ok", data); }
    public static Result<Void> fail(ResultCode code, String message) { ... }
}
```

**HTTP 状态码恒为 200**，业务结果看 `code`。这样客户端只需要一处判断逻辑。

### API-02 DTO / VO / Entity 三分（P0）

| 类型 | 用途 | 允许的字段 |
| --- | --- | --- |
| `XxxDto` | 客户端入参 | 只收客户端该传的 |
| `XxxVo` | 客户端出参 | 只给客户端该看的 |
| `Xxx`（Entity） | 数据库映射 | 数据库的全部字段 |

**禁止把 Entity 直接当响应返回**——数据库加个字段就等于对外接口变更。

### API-03 入参一律校验（P0）

```java
public record CreateCheckInRequest(
        @NotBlank(message = "日期不能为空")
        @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "日期格式应为 yyyy-MM-dd")
        String date,

        @NotBlank(message = "请选择一个品类")
        String shapeId,

        @NotNull @Min(value = 1, message = "数量要大于 0")
        @Max(value = 999, message = "数量太大了")
        Integer count,

        @Size(max = 100, message = "备注最多 100 字")
        String note
) { }
```

```java
@PostMapping("/checkin")
public Result<CheckInVO> create(@RequestBody @Valid CreateCheckInRequest req) { ... }
```

**校验不通过要返回用户能看懂的话**（`message` 直接展示）。

### API-04 禁止用 `Map<String, Object>` 当 DTO（P0）

类型丢失 → 编译期发现不了 → 运行时才发现字段名拼错。

### API-05 时间统一 ISO-8601 且带时区（P0）

```
2026-03-10T10:15:30.000Z     ← 序列化与传输
```

**绝不用** `yyyy-MM-dd HH:mm:ss` 传时间——没有时区信息，跨时区必错。
接收裸毫秒数（`long`）同样禁止，语义不明确。

### API-06 接口路径用小写 + 连字符（P1）

```
GET  /api/check-in/{id}
POST /api/sync/push
```

- 资源名用复数名词。
- 动作用 POST/PUT/DELETE 表达，不写 `POST /getCheckIn`。
- 动作类接口用子资源：`POST /api/sync/push`、`POST /api/account/delete`。

### API-07 写接口要幂等（P0）

重复调用不能产生重复数据。客户端会重试，网络会重传。

```java
// 幂等键由客户端生成，服务端按它去重
public record SyncPushRequest(String deviceId, List<CheckInDto> checkIns) { }
```

本项目的做法：**主键由客户端生成**（`ci_xxx`），服务端按主键 upsert，天然幂等。

### API-08 分页参数统一（P1）

```
GET /api/checkin?page=1&size=20
```

- `page` 从 1 开始（前端友好），DAO 层再转成 offset。
- `size` 必须有上限（默认 20，最大 100），防止 `size=999999` 拖垮数据库。

### API-09 字段增删要向后兼容（P0）

- **可以新增可选字段**（客户端不认识就忽略）。
- **不能删除字段**，只能标 `@Deprecated` 并保留至少一个版本。
- **不能改字段含义**（`openid` 一直是 openid）。

### API-10 批量接口要有上限（P1）

```java
public static final int MAX_BATCH_SIZE = 200;
```

超过上限直接报错，不要"偷偷截断"——截断会让客户端以为全传成功了。

---

## 7. 数据库

### DB-01 表名与字段名（P0）

- 表名、字段名全小写，用 `_` 分隔：`check_in`、`created_at`。
- 表名用**复数**或统一的无名词根（团队内一致即可）。
- 字段名不要与 SQL 关键字冲突（`order`、`group`、`key` 等）。
- 布尔字段用 `is_` 前缀：`is_builtin`、`is_deleted`。
- 金额用 `decimal`，**禁止 `float`/`double`**（精度丢失）。

### DB-02 每张表必备的审计字段（P0）

```sql
`created_at`   DATETIME(3) NOT NULL,   -- 创建时间
`updated_at`   DATETIME(3) NOT NULL,   -- 更新时间
`deleted_at`   DATETIME(3) DEFAULT NULL  -- 软删除墓碑
```

软删除用 `deleted_at` 而不是 `status` 枚举——见 PRD §6.2 的决策。

### DB-03 时间列存 UTC（P0）

**所有时间列存 UTC**，JVM 默认时区也强制 UTC。

> **这是本项目最容易踩的坑。** 表里存 UTC，MySQL 的 `NOW()` 却返回服务器本地时间，
> 两者差一个时差。于是：
> - `ORDER BY created_at DESC` **不会**把最新记录排在最前；
> - 「我的记录去哪儿了」这类问题会被答错；
> - 手工排查时要用 `UTC_TIMESTAMP()`，不是 `NOW()`。
>
> 排查线上数据请统一用 `UTC_TIMESTAMP()`。

### DB-04 复合主键必须显式带上所有键列（P0）

本项目的业务表主键是 `(openid, id)`——`openid` 是租户隔离键。
MyBatis-Plus 的 `@TableId` 只能标一个字段，所以这些实体上标的是 `id`，
**`selectById` / `updateById` 只会按 `id` 匹配，完全无视 `openid`**。

```java
// ❌ 只按 id 匹配，会命中别的账号的记录
checkInMapper.selectById(id);
checkInMapper.updateById(row);       // 更糟：会把同 id 的行全改一遍

// ✅ 显式带 openid
CheckIn row = checkInMapper.selectOne(
    Wrappers.<CheckIn>lambdaQuery()
        .eq(CheckIn::getOpenid, openid)
        .eq(CheckIn::getId, id));
```

**任何按 id 的查询/更新都必须同时带 openid。** 这是多租户数据隔离的最后一道防线。

> 例外：`account` 表的主键真的就是 `openid` 一个字段，
> 它的 `selectById(openid)` 是对的，不要"顺手"改成查条件构造器。

### DB-05 禁止 `SELECT *`（P0）

```java
// ❌ 视图列顺序变化 → 字段错位，而且把密码哈希也查出来了
@Select("SELECT * FROM check_in WHERE openid = #{openid}")
List<CheckIn> list(...);

// ✅ 显式列名
@Select("SELECT id, openid, date, shape_id, count, note FROM check_in WHERE openid = #{openid}")
List<CheckIn> list(...);
```

### DB-06 索引要按查询场景设计（P0）

- 每个**高频查询**都要有索引支撑，尤其是「按租户 + 业务键查」。
- 联合索引遵循**最左前缀**：`(openid, date)` 能支持 `WHERE openid=? AND date=?`，
  但支持不了 `WHERE date=?`。
- 区分度低的列（`deleted_at`）不要单独建索引。
- 索引列上**禁止**函数与隐式类型转换：`WHERE DATE(created_at) = ?` 用不了索引。

```sql
-- ❌ 索引失效
SELECT * FROM check_in WHERE DATE(created_at) = '2026-03-10';

-- ✅
SELECT * FROM check_in WHERE created_at >= '2026-03-10' AND created_at < '2026-03-11';
```

### DB-07 禁止在 SQL 里做业务判断（P0）

金额计算、库存扣减这类逻辑放 Java 里，或放数据库视图/存储过程。SQL 里写 `CASE WHEN` 拼业务，
会让业务规则散落在几十个地方，无法追溯。

### DB-08 批量操作要分批（P1）

```java
// ❌ 一万条一次 insert，锁表 + 撑爆事务日志
for (CheckIn c : list) {
    checkInMapper.insert(c);
}

// ✅ 分批，每批一个事务
for (int i = 0; i < list.size(); i += BATCH_SIZE) {
    checkInMapper.insertBatch(list.subList(i, Math.min(i + BATCH_SIZE, list.size())));
}
```

### DB-09 禁止在事务里做远程调用（P0）

```java
// ❌ 事务里调第三方接口：对方卡 3 秒，你这边的事务就持锁 3 秒
@Transactional
public void createOrder(...) {
    orderMapper.insert(order);
    paymentClient.pay(order);      // ❌
}
```

**顺序：先本地提交，再调外部；外部失败用补偿/对账兜底。**

### DB-10 分页深翻要改法（P1）

`LIMIT 1000000, 20` 会扫描并丢弃一百万行。用**游标分页**（基于上一页最后一条的排序键）。

### DB-11 唯一约束在数据库层加（P0）

"不能重复"靠应用层判断会有并发窗口。数据库唯一索引才是最终防线。

### DB-12 大字段与热数据分离（P1）

图片、JSON 大文本放独立表或对象存储，主表只存引用。主表太宽会拖慢所有查询。

---

## 8. 事务与并发

### TX-01 事务边界在 Service（P0）

`@Transactional` 标在 Service 的 public 方法上。Controller 上标事务是错的——HTTP 层不是事务边界。

### TX-02 `@Transactional` 会失效的三个坑（P0）

1. **自调用失效**：同类内部 `this.methodB()` 不走代理，注解不生效。
2. **异常被吞**：catch 了不抛，事务照常提交。
3. **默认只回滚 RuntimeException**：`@Transactional` 默认不回滚受检异常，
   要回滚得 `@Transactional(rollbackFor = Exception.class)`。

```java
@Transactional(rollbackFor = Exception.class)
public void settle(...) { ... }
```

### TX-03 事务方法要短（P1）

事务里不要做远程调用、不要做大计算、不要 `Thread.sleep`。事务越长，锁持有越久。

### TX-04 明确传播行为（P1）

`REQUIRES_NEW`（挂起当前事务另开一个）、`NESTED`（savepoint）都要显式写出来，
不要依赖默认值。

### CONC-01 线程池必须显式创建并命名（P0）

```java
@Bean("syncExecutor")
public ThreadPoolExecutor syncExecutor() {
    return new ThreadPoolExecutor(
        4, 16, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(1000),
        new ThreadFactoryBuilder().nameFormat("sync-pool-%d").build(),
        new ThreadPoolExecutor.CallerRunsPolicy());
}
```

**禁止** `Executors.newFixedThreadPool`（无界队列，OOM 风险）。
线程池的名字会出现在线程 dump 里，排查问题时能一眼看出是哪个池。

### CONC-02 ThreadLocal 必须在 finally 里清理（P0）

```java
try {
    contextHolder.set(ctx);
    doSomething();
} finally {
    contextHolder.remove();     // ❌ 忘了这行 = 线程复用时串号
}
```

用线程池时尤其致命：线程不会销毁，`remove` 漏了，下一个请求拿到的是别人的上下文。

### CONC-03 共享可变状态要同步（P0）

`SimpleDateFormat` 不是线程安全的（用 `DateTimeFormatter`）；`ArrayList` 被多线程写会丢数据。
能用不可变对象就别用可变对象。

### CONC-04 锁的粒度尽量小、持有时间尽量短（P1）

```java
// ❌ synchronized 锁整个方法，包含了远程调用
public synchronized void handle(Order o) {
    queryRemote();
    updateDb();
}

// ✅ 只锁住临界区
public void handle(Order o) {
    queryRemote();
    synchronized (lock) {
        updateDb();
    }
}
```

### CONC-05 用 `ConcurrentHashMap` 而不是 `Hashtable`（P1）

`Collections.synchronizedMap` 会锁整个 map；`ConcurrentHashMap` 的读是lock-free 的。

### CONC-06 幂等与重试要配套（P0）

网络请求会重传，写接口必须幂等（见 API-07）。重试要带退避与上限，不能无限重试。

---

## 9. Spring Boot 配置与安全

### CFG-01 依赖注入用构造器，不用字段注入（P0）

```java
// ❌ 字段注入：依赖不可 final，测试难 mock，无法保证初始化顺序
@Autowired
private CheckInMapper checkInMapper;

// ✅ 构造器注入
@Service
public class CheckInService {
    private final CheckInMapper checkInMapper;
    public CheckInService(CheckInMapper checkInMapper) {
        this.checkInMapper = checkInMapper;
    }
}
```

**理由**：依赖可以是 `final`（不可变）、不依赖反射就能构造（单测友好）、
启动时就能发现缺失的依赖（而不是运行时 NPE）。

### CFG-02 配置项外置，敏感项走环境变量（P0）

```yaml
app:
  jwt:
    secret: ${APP_JWT_SECRET:...}
```

- **密钥、密码、Token 绝不入库**（见 SEC-02）。
- 配置项要有**默认值与边界校验**：密钥长度不足 32 字节应当**启动即失败**，
  而不是运行到一半才报错。

### CFG-03 `@ConfigurationProperties` 而不是散落的 `@Value`（P1）

```java
@Component
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {
    private String secret;
    private long expireHours = 30;
    // getter/setter
}
```

散落的 `@Value` 无法 IDE 跳转、无法做类型校验、改名要翻遍全项目。

### CFG-04 Bean 的作用域要明确（P1）

默认 `singleton`。有状态（可变成员）的 Bean **绝不能**是 singleton——
要么改造成无状态，要么显式 `@Scope(SCOPE_REQUEST)`。

### CFG-05 不要在 `@PostConstruct` 里做重活（P1）

初始化时的远程调用/大计算会拖慢启动，且失败会拖垮整个应用启动。
用 `ApplicationRunner` 或懒加载，并要有超时。

### CFG-06 优雅停机（P1）

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

### SEC-01 鉴权在服务端，不在客户端（P0）

客户端的"已登录"只是界面状态，**每个请求都要在服务端验 token**。

### SEC-02 密钥不进仓库（P0）

- 密码、AppSecret、Token 一律走环境变量或本机私有配置文件（且该文件必须在 `.gitignore` 里）。
- 提交前用 `git grep` 扫一遍，别把凭据带进历史。

### SEC-03 防 SQL 注入（P0）

- **一律用参数化查询**（`#{}`），**禁止字符串拼接**。
- MyBatis 的 `${}` 是直接替换，**只用于无法参数化的场景**（动态表名、排序字段），
  且必须经过白名单校验。

```java
// ❌
@Select("SELECT * FROM check_in WHERE openid = '" + openid + "'")

// ✅
@Select("SELECT ... WHERE openid = #{openid}")
```

### SEC-04 防 XSS / 路径穿越（P1）

- 前端展示用户输入前转义。
- 文件路径、文件名要校验，禁止 `../`。

### SEC-05 限流与防重放（P1）

- 登录、发短信、导出这类接口要限流。
- 敏感写操作带幂等键或 nonce。

### SEC-06 错误响应不泄露内部信息（P0）

堆栈、SQL、内部类名、主机名，一律不出现在响应体里。详见 ERR-02。

---

## 10. 测试

### TEST-01 测试要能独立运行（P0）

测试之间**不共享状态**、不依赖执行顺序、不依赖开发者本机的残留数据。

### TEST-02 分层测试（P1）

| 层 | 测什么 | 要不要真实依赖 |
| --- | --- | --- |
| 单元测试 | 业务规则、边界、异常分支 | 不需要（mock 掉 Mapper） |
| 集成测试 | SQL、事务、ORM 行为 | **要真实数据库** |
| 接口测试 | 协议、鉴权、响应体 | 起真实容器 |

**集成测试要显式钉住配置**，否则结果取决于开发者本机装了什么：

```java
@SpringBootTest(properties = {
    "app.wechat.app-id=",
    "app.wechat.secret=",
    "app.wechat.app-id-file=target/no-such-project.config.json"
})
@ActiveProfiles({"dev", "local"})
class ApiIntegrationTest { }
```

### TEST-03 测试命名说清意图（P0）

```java
@Test
@DisplayName("真实 openid：建号、存 unionid、且不再标记为 mock")
void realOpenidIsPersisted() { }
```

方法名给英文（`realOpenidIsPersisted`），`@DisplayName` 给中文说明。

### TEST-04 一个用例只测一件事（P1）

一个测试断言 5 件事，失败时不知道是哪件坏了。

### TEST-05 断言要具体（P0）

```java
// ❌ 永远通过
assertNotNull(result);

// ✅ 说清期望什么
assertThat(result).isNotNull();
assertThat(result.getOpenid()).isEqualTo("oREAL_openid_1");
assertThat(result.isMock()).isFalse();
```

### TEST-06 覆盖边界与异常路径（P0）

每个业务方法至少覆盖：正常、空值、上限、超限、并发冲突、依赖失败。

### TEST-07 不测实现细节（P1）

测**行为**（输入什么、产生什么结果），不要测私有方法的调用次数。
重构内部实现时不该让测试全红。

### TEST-08 测试代码也要符合规范（P1）

命名、断言、注释同样有标准。测试是生产代码的一部分。

---

## 11. 禁止事项清单

以下为 **P0**，评审时逐条对照：

| # | 禁止 | 为什么 |
| --- | --- | --- |
| 1 | 禁止 `System.out` / `printStackTrace` | 生产环境无法按级别过滤，日志进不了采集管道 |
| 2 | 禁止空 catch / 吞异常 | 故障静默，线上无从发现 |
| 3 | 禁止在 SQL 里拼字符串 | SQL 注入 |
| 4 | 禁止 `SELECT *` | 字段错位 + 泄露无关字段 |
| 5 | 禁止按 id 单独查询租户表 | 跨账号数据泄露 |
| 6 | 禁止 `float`/`double` 存金额 | 精度丢失 |
| 7 | 禁止裸毫秒时间戳 | 时区语义不明 |
| 8 | 禁止在事务里调远程接口 | 长事务持锁 |
| 9 | 禁止字段注入 `@Autowired` | 依赖不可不可变、启动期发现不了缺失 |
| 10 | 禁止硬编码密钥/密码 | 泄露 |
| 11 | 禁止 `Executors.newFixedThreadPool` | 无界队列，OOM |
| 12 | 禁止在业务里用魔法值 | 语义丢失，改一处漏一处 |
| 13 | 禁止把 Entity 直接返回给前端 | 数据库结构变更 = 接口破坏 |
| 14 | 禁止把异常堆栈返回给前端 | 泄露内部实现 |
| 15 | 禁止 `!=` 比较包装类型 | `Integer` 与 `int` 的坑 |
| 16 | 禁止在 `finally` 里做可能抛异常的事 | 盖掉原始异常 |
| 17 | 禁止用 `localhost`/`127.0.0.1` 配跨机访问 | 真机上指向手机自己 |
| 18 | 禁止让文件助手抛异常 | 拒绝会毒化上游 Promise，表现为"点了没反应" |
| 19 | 禁止在 catch 里 `log.error` 后又往上抛 | 同一故障刷屏 |
| 20 | 禁止用异常表达正常的"查不到" | 异常不是流程控制手段 |

---

## 12. 代码评审清单

评审时按顺序过，任何一条不过就打回或要求说明。

### 12.1 正确性

- [ ] 边界条件处理了吗？（空、0、最大值、超长、并发）
- [ ] 异常路径有处理吗？还是只是"正常流程能跑"？
- [ ] 事务边界对吗？（见 TX-02 的三个坑）
- [ ] 时间处理对吗？（UTC、时区、跨天）
- [ ] 金额/数量计算精度对吗？
- [ ] 幂等吗？（重传会不会产生重复数据）

### 12.2 安全

- [ ] 有没有硬编码的密钥、密码、Token？
- [ ] SQL 是参数化的吗？
- [ ] 响应体里有没有泄露内部信息？
- [ ] 越权风险：这个接口会不会查到别的 openid 的数据？
- [ ] 日志里有没有敏感信息？

### 12.3 数据

- [ ] 索引支撑这条查询了吗？
- [ ] 是不是 `SELECT *`？
- [ ] 租户键（openid）在每条查询里吗？
- [ ] 大事务？远程调用在事务里？

### 12.4 可维护性

- [ ] 命名能看出意图吗？
- [ ] 注释解释的是"为什么"吗？
- [ ] 有没有过期的注释？
- [ ] 分层对吗？业务逻辑漏在 Controller 里了吗？
- [ ] 重复代码超过三处就该抽了。

### 12.5 可观测性

- [ ] 关键分支有日志吗？级别对吗？
- [ ] 异常日志带得上定位信息吗？（ID、用户、耗时）
- [ ] 同一个故障会不会打很多遍？

### 12.6 测试

- [ ] 新逻辑有测试吗？
- [ ] 异常分支测了吗？
- [ ] 测试不依赖执行顺序、不依赖本机残留数据吧？

---

## 13. 附录：本项目的具体约定

以下是**本项目**的既定约定，与上面的通用规则配套使用。

### 13.1 分层与包

```
com.nietu.daka
├── common/      Result、ResultCode、BizException、GlobalExceptionHandler
├── config/      MybatisPlusConfig、WebMvcConfig、TimeZoneConfig、WechatProperties
├── controller/  AuthController、CheckInController、StatsController、…
├── dto/         入参/出参 record
├── entity/      数据库映射
├── mapper/      MyBatis-Plus Mapper + 显式列名 @Select
├── security/    AuthInterceptor、JwtTokenProvider、AuthContext、JwtProperties
└── service/     AuthService、CheckInService、SyncService、WechatAuthService、…
```

### 13.2 响应与异常

- 统一 `Result<T>`：`{ code, message, data }`，HTTP 恒 200。
- 业务异常 `BizException` + `ResultCode` 枚举；技术异常原样抛出。
- `GlobalExceptionHandler` 统一兜底，**不回吐内部信息**。

### 13.3 租户隔离

- 所有业务表的复合主键是 `(openid, id)`。
- **任何按 id 的查询都必须带 openid**（DB-04）。
- `AuthInterceptor` 校验 token，并把 openid 放进 `AuthContext`。

### 13.4 时间

- 客户端传 ISO-8601（UTC）；服务端按 UTC 存、按 UTC 比。
- JVM 默认时区由 `TimeZoneConfig` 强制 UTC（**不能只写在 `main()` 里**——
  `@SpringBootTest` 不执行 `main()`，测试会跑在本机时区）。

### 13.5 前端与后端的契约

| 约定 | 说明 |
| --- | --- |
| token 位置 | 只在 `Authorization: Bearer <token>` 头，不放 body |
| 登录返回 | `{ token, account: { openid, unionid, … }, newUser, expireSeconds, mock }` |
| 未知字段 | DTO 一律 `@JsonIgnoreProperties(ignoreUnknown = true)` |
| 软删除 | 客户端发 `deleted: true` **或** `deletedAt` 非空，任一成立即删除 |
| 幂等 | 主键由客户端生成（`ci_xxx`），服务端按主键 upsert |
| 时间 | 一律 ISO-8601；**禁止裸毫秒** |

### 13.6 微信登录

- **AppID 后端自己从小程序工程读**（`app.wechat.app-id-file`），保证两边一致——
  appid 不一致正是微信 `40029 invalid code` 的头号原因。
- **没配 AppSecret 时自动降级为 mock**，并在响应里带 `mock: true`，
  客户端要把它显示出来（别让人对着数据库找自己的账号）。
- **昵称不是微信给的**：`code2session` 只返回 `openid`/`session_key`/`unionid`。
  昵称只能由用户点 `<input type="nickname">` 的昵称建议拿到。
- **`session_key` 不落库**（PRD §5.6.2）。

### 13.7 隐私

- 未登录时界面上**不出现任何属于用户的内容**（数字、记录、作品、素材、品类、标签），
  一律按空处理，文案写「登录后可见」。
- 写操作（打卡、编辑、售出）必须登录。
- **但绝不拦截**：不弹全屏登录页、不做强制跳转、不遮挡页面。
- 退出登录**只藏不删**；只有「注销账号」才清空本机与云端。
- 页面跳转守卫在 `utils/require-login.js`；`utils/auth.js` **不含任何 `navigateTo`/`showModal`**
  （账号状态机要保持无副作用）。

---

## 附：引用本文档

写规范或评审时用编号引用：

```
PR 描述：违反 DB-04（租户表查询必须带 openid），已修复。
评审意见：ERR-02 的兜底 handler 不能把 e.getMessage() 直接返回给用户。
```

改这份文档请提 PR，并在 `README.md` 的目录里同步。

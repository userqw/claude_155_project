# 前端 API 客户端

零依赖的 ES module，一个文件覆盖后端全部 45 个接口。

## 怎么用

```js
import api from './api/client.js';

const { token, mock } = await api.account.login({ code, nickname, avatarUrl });
const page = await api.checkin.list({ year: 2026, page: 1, size: 20 });
```

**token 从哪来**：先调 `api.account.login({ code })`（`code` 是 `wx.login()` 返回的临时码），
成功返回的 `token` 已经自动写进 `localStorage`，之后每个请求都会自动带
`Authorization: Bearer <token>`，不用手动加。`api.clearToken()` 可以手动退出。

**错误怎么接**：成功时 resolve 的是 `data` 本身；失败时 reject 一个 `ApiError`，
带 `code` 与 `message`（`code === 401` 表示登录过期，客户端已自动清掉本地 token）。

```js
try {
  await api.sales.create({ checkInId, quantity: 99, unitPrice: 30, soldDate: '2026-03-10' });
} catch (err) {
  if (err.code === 400) toast(err.message);
  else if (err.code === 401) gotoLogin();
}
```

## 怎么改成别的端口 / 别的后端

只改 `client.js` 顶部**一行**：

```js
const BASE_URL = 'http://127.0.0.1:8080';
```

换成局域网 IP（真机预览用）、别的端口或线上域名，都只动这一行。
注意：**真机预览时 `127.0.0.1` 指的是手机自己**，得换成电脑的局域网 IP（`ipconfig` 看 IPv4）。

## 接口分组

`account` · `checkin` · `shapes` · `tags` · `sales` · `trash` · `material` · `stats` · `sync`

字段与错误码的完整说明见 `005.后端代码/docs/api.md`。

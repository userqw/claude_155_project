/**
 * 捏土打卡 · 后端 API 客户端（零依赖，纯 ES module）
 *
 * ─────────────────────────────────────────────────────────────
 *  对接别的后端**只改这一行**：
 *
 *      const BASE_URL = 'http://127.0.0.1:8080';
 *
 *  换端口、换局域网 IP、换线上域名，都只动它，别的一行都不用改。
 * ─────────────────────────────────────────────────────────────
 *
 * 用法：
 *
 *     import api from './api/client.js';
 *
 *     const { token, mock } = await api.account.login({ code, nickname, avatarUrl });
 *     const page = await api.checkin.list({ year: 2026, page: 1, size: 20 });
 *     const shapes = await api.shapes.list();
 *
 * 约定：
 * - 服务端恒返回 HTTP 200 + { code, message, data }。code === 0 才算成功。
 * - 成功时 resolve 的是 data 本身（不是整个 body），失败时 reject 一个带
 *   code 与 message 的 ApiError。
 * - code === 401 表示未登录 / 登录已过期，客户端会**自动清掉本地 token**，
 *   并抛出 code 为 401 的错误，由调用方决定跳不跳登录页。
 */

const BASE_URL = 'http://127.0.0.1:8080';

/** token 在 localStorage 里的键名 */
const TOKEN_KEY = 'nietu_daka_token';

/** 分页默认参数（与后端约定一致） */
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

/* ------------------------------------------------------------------ *
 * token
 * ------------------------------------------------------------------ */

/** 取当前 token，没有就是 null */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    // 隐私模式等场景下 localStorage 可能直接抛
    return null;
  }
}

/** 存 token。登录成功后调用 */
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    /* 存不进去就算了，调用方自己处理 */
  }
}

/** 清 token。退出登录、收到 401 时调用 */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    /* 同上 */
  }
}

/** 当前是否已登录（本地有 token） */
export function isLoggedIn() {
  return !!getToken();
}

/* ------------------------------------------------------------------ *
 * 错误
 * ------------------------------------------------------------------ */

/**
 * 业务错误。既是 Error（能进 catch 的常规流程），又带 code / message。
 *
 * code 取值：
 *   0   成功（不会出现在错误里）
 *   400 参数不合法
 *   401 未登录或登录已过期
 *   403 无权
 *   404 不存在
 *   500 服务端内部错误
 *   -1  网络层错误（请求没发出去 / 响应不是 JSON），**不是**业务失败
 */
export class ApiError extends Error {
  constructor(code, message) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = code;
    this.isApiError = true;
    /** 401 时为 true，方便调用方快速判断「要不要跳登录页」 */
    this.unauthorized = code === 401;
  }
}

/* ------------------------------------------------------------------ *
 * 底层请求
 * ------------------------------------------------------------------ */

/**
 * 把 query 对象拼成 query string。
 *
 * 跳过 `undefined` 与 `null`（不传这个参数）；
 * **空串会照发**——`folderId=` 表示「只查未分类」，与小程序本地那套
 * （`utils/db.js` 的 `listMaterials`）语义一致。
 */
function buildUrl(path, query) {
  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

/**
 * 统一请求。成功 resolve data，失败 reject ApiError。
 *
 * @param {string} method  GET / POST / PUT / DELETE
 * @param {string} path    以 / 开头的路径
 * @param {object} [opts]
 * @param {object} [opts.query] query 参数
 * @param {object} [opts.body]   JSON body
 * @param {boolean}[opts.auth]   是否带 token，默认 true
 * @param {boolean}[opts.raw]    true 时 resolve 整个 { code, message, data }
 */
export async function request(method, path, opts = {}) {
  const { query, body, auth = true, raw = false } = opts;

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    // 请求根本没发出去（断网 / 域名不对 / CORS 拦了）
    throw new ApiError(-1, '网络连接失败，请检查网络或后端地址');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    // 响应不是 JSON：多半是网关 / 代理返回了 HTML 错误页
    throw new ApiError(-1, `服务返回了非 JSON 内容（HTTP ${res.status}）`);
  }

  if (!payload || typeof payload.code !== 'number') {
    throw new ApiError(-1, '服务返回格式不正确');
  }

  if (payload.code !== 0) {
    // 登录过期：先把本地 token 清掉，再抛出去
    if (payload.code === 401) clearToken();
    throw new ApiError(payload.code, payload.message);
  }

  return raw ? payload : payload.data;
}

/** GET 快捷方法 */
function get(path, query, opts = {}) {
  return request('GET', path, { ...opts, query });
}

/** POST 快捷方法 */
function post(path, body, opts = {}) {
  return request('POST', path, { ...opts, body: body === undefined ? {} : body });
}

/** PUT 快捷方法 */
function put(path, body, opts = {}) {
  return request('PUT', path, { ...opts, body: body === undefined ? {} : body });
}

/** DELETE 快捷方法（body 可选，参数一般走 query） */
function del(path, query, opts = {}) {
  return request('DELETE', path, { ...opts, query });
}

/* ------------------------------------------------------------------ *
 * 账号
 * ------------------------------------------------------------------ */

export const account = {
  /**
   * 微信一键登录（首次登录自动注册）。
   * @param {{code: string, nickname?: string, avatarUrl?: string}} params
   * @returns {Promise<{token: string, account: object, newUser: boolean, expireSeconds: number, mock: boolean}>}
   *          成功后 token 已自动写入 localStorage。
   */
  async login({ code, nickname, avatarUrl } = {}) {
    const data = await post('/api/login', { code, nickname, avatarUrl }, { auth: false });
    if (data && data.token) setToken(data.token);
    return data;
  },

  /** 取当前账号资料 + mock 状态 */
  getProfile() {
    return get('/api/profile');
  },

  /** 修改昵称头像（只改资料，不重新登录） */
  updateProfile({ nickname, avatarUrl } = {}) {
    return post('/api/profile', { nickname, avatarUrl });
  },

  /** 注销账号并清空该账号云端全部数据。成功后本地 token 也会被清掉 */
  async deleteAccount() {
    const data = await post('/api/account/delete');
    clearToken();
    return data;
  },

  /** 健康检查（免鉴权），用于探活 */
  health() {
    return get('/api/health', undefined, { auth: false });
  },
};

/* ------------------------------------------------------------------ *
 * 打卡
 * ------------------------------------------------------------------ */

export const checkin = {
  /**
   * 分页查询打卡记录
   * @param {{year?: number, shapeId?: string, page?: number, size?: number}} params
   */
  list({ year, shapeId, page = DEFAULT_PAGE, size = DEFAULT_SIZE } = {}) {
    return get('/api/checkin', { year, shapeId, page, size: Math.min(size, MAX_SIZE) });
  },

  /**
   * 新建打卡记录
   * @param {{id?: string, date: string, shapeId: string, count: number, note?: string,
   *          durationMin?: number, coverPhotoId?: string, tagIds?: string[], photos?: object[]}} payload
   */
  create(payload) {
    return post('/api/checkin', payload);
  },

  /** 修改打卡记录 */
  update(id, payload) {
    return put(`/api/checkin/${encodeURIComponent(id)}`, payload);
  },

  /** 软删除打卡记录（进 30 天回收站） */
  remove(id) {
    return del(`/api/checkin/${encodeURIComponent(id)}`);
  },

  /** 从回收站恢复 */
  restore(id) {
    return post(`/api/checkin/${encodeURIComponent(id)}/restore`);
  },
};

/* ------------------------------------------------------------------ *
 * 品类（造型）
 * ------------------------------------------------------------------ */

export const shapes = {
  /** 列出全部品类（含内置四个），带每个品类的累计用量 */
  list() {
    return get('/api/shapes');
  },

  /**
   * 新建自定义品类。
   * 注意：**色槽 slot 由服务端分配**（4~7 里第一个没被占用的），
   * 契约里没有这个入参；自定义品类最多 4 个，用满了服务端返回 400。
   */
  create({ name, icon, iconPath, color, defaultPrice } = {}) {
    return post('/api/shapes', { name, icon, iconPath, color, defaultPrice });
  },

  /** 修改品类（内置的只能改 name 与 icon/iconPath） */
  update(id, { name, icon, iconPath, color, defaultPrice } = {}) {
    return put(`/api/shapes/${encodeURIComponent(id)}`, {
      name,
      icon,
      iconPath,
      color,
      defaultPrice,
    });
  },

  /** 删除自定义品类（历史记录迁到「其他」；内置的不可删） */
  remove(id) {
    return del(`/api/shapes/${encodeURIComponent(id)}`);
  },

  /** 按数组顺序重排 */
  reorder(ids) {
    return post('/api/shapes/reorder', { ids });
  },
};

/* ------------------------------------------------------------------ *
 * 标签
 * ------------------------------------------------------------------ */

export const tags = {
  /** 列出全部标签 */
  list() {
    return get('/api/tags');
  },

  /** 新建标签 */
  create({ name, color } = {}) {
    return post('/api/tags', { name, color });
  },

  /** 修改标签 */
  update(id, { name, color } = {}) {
    return put(`/api/tags/${encodeURIComponent(id)}`, { name, color });
  },

  /** 删除标签（内置的不可删） */
  remove(id) {
    return del(`/api/tags/${encodeURIComponent(id)}`);
  },
};

/* ------------------------------------------------------------------ *
 * 售出
 * ------------------------------------------------------------------ */

export const sales = {
  /** 列出售出记录，可按打卡记录过滤 */
  list({ checkInId } = {}) {
    return get('/api/sales', { checkInId });
  },

  /**
   * 新增售出记录。数量不能超过该条记录的未售出数量，超了服务端返回 400
   * @param {{checkInId: string, quantity: number, unitPrice: number,
   *          soldDate: string, channel?: string, note?: string}} payload
   */
  create({ checkInId, quantity, unitPrice, soldDate, channel, note } = {}) {
    return post('/api/sales', { checkInId, quantity, unitPrice, soldDate, channel, note });
  },

  /** 撤掉一条售出记录（软删除）。售出记录只增不改 */
  remove(id) {
    return del(`/api/sales/${encodeURIComponent(id)}`);
  },
};

/* ------------------------------------------------------------------ *
 * 回收站
 * ------------------------------------------------------------------ */

export const trash = {
  /** 回收站列表（打卡记录 + 素材） */
  list() {
    return get('/api/trash');
  },

  /** 彻底删除一条（不可恢复）。entityType 取 'check_in' | 'material' */
  purge({ entityType, id } = {}) {
    return del('/api/trash', { entityType, id });
  },

  /** 清空回收站 */
  purgeAll() {
    return del('/api/trash/all');
  },
};

/* ------------------------------------------------------------------ *
 * 素材库
 * ------------------------------------------------------------------ */

export const material = {
  /** 文件夹列表 */
  listFolders() {
    return get('/api/material/folder');
  },

  /** 新建文件夹 */
  createFolder({ id, name, sort, coverMaterialId } = {}) {
    return post('/api/material/folder', { id, name, sort, coverMaterialId });
  },

  /** 文件夹改名 */
  renameFolder(id, name) {
    return put(`/api/material/folder/${encodeURIComponent(id)}`, { name });
  },

  /** 按数组顺序重排文件夹 */
  reorderFolders(ids) {
    return post('/api/material/folder/reorder', { ids });
  },

  /** 删除文件夹。素材不删，转「未分类」 */
  deleteFolder(id) {
    return del(`/api/material/folder/${encodeURIComponent(id)}`);
  },

  /** 素材列表，可按文件夹过滤 */
  listMaterials({ folderId } = {}) {
    return get('/api/material', { folderId });
  },

  /** 新增素材 */
  createMaterial({ id, folderId, url, localPath, name, note } = {}) {
    return post('/api/material', { id, folderId, url, localPath, name, note });
  },

  /**
   * 修改素材的名称、备注、所属文件夹。
   * 注意：url / localPath 不会被改（图片是选图时就定下的），要换图请删掉重建。
   */
  updateMaterial(id, { folderId, name, note } = {}) {
    return put(`/api/material/${encodeURIComponent(id)}`, { folderId, name, note });
  },

  /** 删除素材（软删除，30 天回收站） */
  deleteMaterial(id) {
    return del(`/api/material/${encodeURIComponent(id)}`);
  },
};

/* ------------------------------------------------------------------ *
 * 统计
 * ------------------------------------------------------------------ */

export const stats = {
  /** 年度总览。该年无记录返回全 0，不是 404 */
  year(year) {
    return get('/api/stats/year', { year });
  },

  /** 跨年对比（与上一年比产量） */
  compare(year) {
    return get('/api/stats/compare', { year });
  },

  /** 按月的产量 */
  monthlyProduction(year) {
    return get('/api/stats/monthly-production', { year });
  },

  /** 按月的营收 */
  monthlyRevenue(year) {
    return get('/api/stats/monthly-revenue', { year });
  },

  /** 品类分布 */
  shapes(year) {
    return get('/api/stats/shapes', { year });
  },

  /** 按品类的结缘金 */
  shapeRevenue(year) {
    return get('/api/stats/shape-revenue', { year });
  },

  /** 按渠道的结缘金 */
  channelRevenue(year) {
    return get('/api/stats/channel-revenue', { year });
  },

  /** 库存（累计口径，跨年结转） */
  inventory() {
    return get('/api/stats/inventory');
  },

  /** 逐日产量（日历热力图） */
  daily(year) {
    return get('/api/stats/daily', { year });
  },
};

/* ------------------------------------------------------------------ *
 * 同步
 * ------------------------------------------------------------------ */

export const sync = {
  /**
   * 推送本地变更（字段级合并，后写覆盖先写）
   * @param {{deviceId?: string, checkIns?: object[], sales?: object[], photos?: object[],
   *          folders?: object[], materials?: object[], shapes?: object[], tags?: object[]}} payload
   */
  push({ deviceId, checkIns, sales, photos, folders, materials, shapes, tags } = {}) {
    return post('/api/sync/push', { deviceId, checkIns, sales, photos, folders, materials, shapes, tags });
  },

  /** 拉取增量变更。since 为 ISO-8601 串，不传（也没有意义传空串）= 全量 */
  pull(since) {
    // 空串会让服务端的时间参数解析失败，所以这里显式不传
    return get('/api/sync/pull', since ? { since } : {});
  },
};

/* ------------------------------------------------------------------ *
 * 默认导出：把所有分组挂在一个对象上，方便 `import api from '...'`
 * ------------------------------------------------------------------ */

const api = {
  // 底层
  request,
  getToken,
  setToken,
  clearToken,
  isLoggedIn,
  ApiError,
  // 业务分组
  account,
  checkin,
  shapes,
  tags,
  sales,
  trash,
  material,
  stats,
  sync,
};

export default api;

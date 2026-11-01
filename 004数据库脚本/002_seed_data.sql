-- =============================================================================
-- 捏土打卡 · 初始数据
--
-- 说明：内置造型与标签是「每个账号各存一份」（用户可改名/改色/改价/改排序），
-- 所以这些种子数据要在用户首次登录、服务端建号之后，按该 openid 复制一份再插入。
--
-- ★ 插入顺序有外键依赖，不能调换：
--     account → shape / tag / device
--   shape、tag 都外键引用 account，必须先有账号行。
--
-- 用法：把 REPLACE_WITH_OPENID / REPLACE_WITH_DEVICE_ID 占位（连引号一起）替换成实际值后执行。
--       占位符带引号，写成 'REPLACE_WITH_OPENID'，替换时只换引号里面的内容。
-- =============================================================================

USE `nietu_daka`;

-- 连接字符集必须是 utf8mb4：默认 latin1 会把中文/emoji 的字节算错，
-- 插入时会报「Data too long for column 'name'」这种看不懂的错
SET NAMES utf8mb4;

SET @openid = 'REPLACE_WITH_OPENID';

-- -----------------------------------------------------------------------------
-- 1. 账号（服务端建号时插入；注册是隐式的，第一次见到 openid 就建）
-- -----------------------------------------------------------------------------
INSERT INTO `account`
  (`openid`, `unionid`, `nickname`, `avatar_url`, `data_scope`, `created_at`, `last_login_at`)
VALUES
  ('REPLACE_WITH_OPENID', NULL, NULL, NULL, 'cloud', NOW(3), NOW(3));

-- -----------------------------------------------------------------------------
-- 2. 内置造型：与 001/utils/constants.js 的 BUILTIN_SHAPES 完全一致
--    color 取自 dataviz 校验过的马卡龙分类色板（亮色模式）
-- -----------------------------------------------------------------------------
INSERT INTO `shape`
  (`openid`, `id`, `name`, `icon`, `icon_path`, `color`, `slot`, `default_price`, `default_cost`, `sort`, `is_builtin`, `created_at`, `updated_at`)
VALUES
  (@openid, 'shape_ob11',    'OB11娃头', '🧸', '/assets/icons/ob11.svg', '#F68CA1', 0, NULL, NULL, 0, 1, NOW(3), NOW(3)),
  (@openid, 'shape_qq',      'QQ人',     '🙂', '/assets/icons/qq.svg',   '#55BCFA', 1, NULL, NULL, 1, 1, NOW(3), NOW(3)),
  (@openid, 'shape_zhengbi', '正比',     '🧍', NULL,                    '#54CB99', 2, NULL, NULL, 2, 1, NOW(3), NOW(3)),
  (@openid, 'shape_other',   '其他',     '✨', NULL,                    '#C49BF3', 3, NULL, NULL, 3, 1, NOW(3), NOW(3));

-- -----------------------------------------------------------------------------
-- 3. 内置标签：与 001/utils/constants.js 的 BUILTIN_TAGS 完全一致
-- -----------------------------------------------------------------------------
INSERT INTO `tag`
  (`openid`, `id`, `name`, `color`, `is_builtin`, `created_at`, `updated_at`)
VALUES
  (@openid, 'tag_limit',    '限定配色', '#EB6834', 1, NOW(3), NOW(3)),
  (@openid, 'tag_practice', '练手',     '#2A78D6', 1, NOW(3), NOW(3)),
  (@openid, 'tag_gift',     '送人',     '#1BAF7A', 1, NOW(3), NOW(3)),
  (@openid, 'tag_rework',   '返工',     '#EDA100', 1, NOW(3), NOW(3)),
  (@openid, 'tag_urgent',   '急单',     '#E87BA4', 1, NOW(3), NOW(3)),
  (@openid, 'tag_dropped',  '已淘汰',   '#898781', 1, NOW(3), NOW(3));

-- -----------------------------------------------------------------------------
-- 4. 设备（客户端首次安装生成 device id 后上报）
-- -----------------------------------------------------------------------------
INSERT INTO `device`
  (`openid`, `id`, `device_name`, `last_sync_at`, `pushed_count`, `created_at`, `updated_at`)
VALUES
  (@openid, 'REPLACE_WITH_DEVICE_ID', NULL, NULL, 0, NOW(3), NOW(3));

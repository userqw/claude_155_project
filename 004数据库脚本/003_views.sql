-- =============================================================================
-- 捏土打卡 · 统计视图
-- 把 PRD §6.3 的统计口径固化成视图，服务端接口、报表、BI 用同一份口径，
-- 避免各处各写一遍 SQL 把「产量按打卡日、营收按售出日」这条规则写错。
--
-- 对应 001/utils/stat.js 的 yearlyOverview()。
-- =============================================================================

USE `nietu_daka`;

-- 连接字符集必须是 utf8mb4：默认 latin1 会把中文/emoji 的字节算错，
-- 插入时会报「Data too long for column 'name'」这种看不懂的错
SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- v_yearly_production —— 年度产量
--   口径：累计产量 = 未删除记录的 count 之和，按【打卡日期】归属年份
--   有记录天数 = 该年出现过的不同打卡日期数
--   日均产出 = 累计产量 ÷ 有记录天数（不是 ÷ 全年天数）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_yearly_production`;
CREATE VIEW `v_yearly_production` AS
SELECT
  `openid`,
  YEAR(`date`)                       AS `year`,
  SUM(`count`)                       AS `production`,
  COUNT(*)                           AS `record_count`,
  COUNT(DISTINCT `date`)             AS `active_days`,
  ROUND(SUM(`count`) / NULLIF(COUNT(DISTINCT `date`), 0), 2) AS `avg_per_day`
FROM `check_in`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, YEAR(`date`);

-- -----------------------------------------------------------------------------
-- v_yearly_revenue —— 年度营收
--   口径：营收 = 售出记录 total_amount 之和，按【售出日期】归属年份
--   注意与 v_yearly_production 的归属键不同（sold_date ≠ date），这是最容易算错的地方
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_yearly_revenue`;
CREATE VIEW `v_yearly_revenue` AS
SELECT
  `openid`,
  YEAR(`sold_date`)  AS `year`,
  SUM(`total_amount`) AS `revenue`,
  SUM(`quantity`)    AS `sold_count`
FROM `sale`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, YEAR(`sold_date`);

-- -----------------------------------------------------------------------------
-- v_yearly_overview —— 年度总览（把产量与营收并到一起）
--   未售出数量 = 累计产量 − 售出数量
--   负数时按 0 显示并给出提示：oversold = 1 时前端要弹警示
--   （跨年卖出或记录被删都会造成这个情况，见 CLAUDE.md 领域规则第 2 条）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_yearly_overview`;
CREATE VIEW `v_yearly_overview` AS
SELECT
  p.`openid`,
  p.`year`,
  p.`production`,
  p.`record_count`,
  p.`active_days`,
  p.`avg_per_day`,
  COALESCE(r.`revenue`, 0)      AS `revenue`,
  COALESCE(r.`sold_count`, 0)   AS `sold_count`,
  GREATEST(p.`production` - COALESCE(r.`sold_count`, 0), 0) AS `unsold`,
  CASE WHEN p.`production` - COALESCE(r.`sold_count`, 0) < 0 THEN 1 ELSE 0 END AS `oversold`,
  ROUND(COALESCE(r.`revenue`, 0) / NULLIF(r.`sold_count`, 0), 2) AS `avg_price`
FROM `v_yearly_production` p
LEFT JOIN `v_yearly_revenue` r
  ON r.`openid` = p.`openid` AND r.`year` = p.`year`;

-- -----------------------------------------------------------------------------
-- v_monthly_production —— 月度产量（年度统计的月度趋势图）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_monthly_production`;
CREATE VIEW `v_monthly_production` AS
SELECT
  `openid`,
  YEAR(`date`)  AS `year`,
  MONTH(`date`) AS `month`,
  SUM(`count`)  AS `production`,
  COUNT(DISTINCT `date`) AS `active_days`
FROM `check_in`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, YEAR(`date`), MONTH(`date`);

-- -----------------------------------------------------------------------------
-- v_monthly_revenue —— 月度营收（营收统计的折线图）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_monthly_revenue`;
CREATE VIEW `v_monthly_revenue` AS
SELECT
  `openid`,
  YEAR(`sold_date`)  AS `year`,
  MONTH(`sold_date`) AS `month`,
  SUM(`total_amount`) AS `revenue`,
  SUM(`quantity`)    AS `sold_count`
FROM `sale`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, YEAR(`sold_date`), MONTH(`sold_date`);

-- -----------------------------------------------------------------------------
-- v_shape_distribution —— 造型分布（分类占比条形图）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_shape_distribution`;
CREATE VIEW `v_shape_distribution` AS
SELECT
  c.`openid`,
  YEAR(c.`date`) AS `year`,
  c.`shape_id`,
  s.`name`  AS `shape_name`,
  s.`icon`  AS `shape_icon`,
  s.`color` AS `shape_color`,
  s.`slot`  AS `shape_slot`,
  SUM(c.`count`) AS `production`
FROM `check_in` c
JOIN `shape` s ON s.`id` = c.`shape_id` AND s.`openid` = c.`openid`
WHERE c.`deleted_at` IS NULL AND s.`deleted_at` IS NULL
GROUP BY c.`openid`, YEAR(c.`date`), c.`shape_id`, s.`name`, s.`icon`, s.`color`, s.`slot`;

-- -----------------------------------------------------------------------------
-- v_shape_revenue —— 按造型的结缘金（营收页「哪种造型最赚钱」）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_shape_revenue`;
CREATE VIEW `v_shape_revenue` AS
SELECT
  c.`openid`,
  YEAR(sl.`sold_date`) AS `year`,
  c.`shape_id`,
  s.`name`  AS `shape_name`,
  s.`color` AS `shape_color`,
  SUM(sl.`total_amount`) AS `revenue`,
  SUM(sl.`quantity`)     AS `sold_count`,
  ROUND(SUM(sl.`total_amount`) / NULLIF(SUM(sl.`quantity`), 0), 2) AS `avg_price`
FROM `sale` sl
JOIN `check_in` c ON c.`id` = sl.`check_in_id` AND c.`openid` = sl.`openid`
JOIN `shape` s     ON s.`id` = c.`shape_id` AND s.`openid` = c.`openid`
WHERE sl.`deleted_at` IS NULL AND c.`deleted_at` IS NULL
GROUP BY c.`openid`, YEAR(sl.`sold_date`), c.`shape_id`, s.`name`, s.`color`;

-- -----------------------------------------------------------------------------
-- v_channel_revenue —— 按渠道的结缘金（营收页「结缘渠道来源构成」）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_channel_revenue`;
CREATE VIEW `v_channel_revenue` AS
SELECT
  `openid`,
  YEAR(`sold_date`) AS `year`,
  `channel`,
  SUM(`total_amount`) AS `revenue`,
  SUM(`quantity`)     AS `sold_count`
FROM `sale`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, YEAR(`sold_date`), `channel`;

-- -----------------------------------------------------------------------------
-- v_inventory —— 库存（跨年结转后的「做 / 卖」对照）
--   口径与年度视图不同：年度视图按年各自结算，库存看的是累计口径
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_inventory`;
CREATE VIEW `v_inventory` AS
SELECT
  c.`openid`,
  c.`shape_id`,
  s.`name`  AS `shape_name`,
  s.`color` AS `shape_color`,
  SUM(c.`count`)                              AS `made`,
  SUM(COALESCE(sl.`sold`, 0))                 AS `sold`,
  GREATEST(SUM(c.`count`) - SUM(COALESCE(sl.`sold`, 0)), 0) AS `stock`
FROM `check_in` c
LEFT JOIN (
  SELECT `openid`, `check_in_id`, SUM(`quantity`) AS `sold`
  FROM `sale`
  WHERE `deleted_at` IS NULL
  GROUP BY `openid`, `check_in_id`
) sl ON sl.`openid` = c.`openid` AND sl.`check_in_id` = c.`id`
JOIN `shape` s ON s.`id` = c.`shape_id` AND s.`openid` = c.`openid`
WHERE c.`deleted_at` IS NULL AND s.`deleted_at` IS NULL
GROUP BY c.`openid`, c.`shape_id`, s.`name`, s.`color`;
-- 上面用的是 SUM(...) 相减而不是直接引用 sl.sold：
-- MySQL 默认 only_full_group_by 下，直接引用连接列会报
-- 「Expression #4 of SELECT list is not in GROUP BY clause」。

-- -----------------------------------------------------------------------------
-- v_daily_production —— 逐日产量（日历热力图）
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_daily_production`;
CREATE VIEW `v_daily_production` AS
SELECT
  `openid`,
  `date`,
  SUM(`count`) AS `production`
FROM `check_in`
WHERE `deleted_at` IS NULL
GROUP BY `openid`, `date`;

-- -----------------------------------------------------------------------------
-- v_material_folder_count —— 各素材文件夹的素材数
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_material_folder_count`;
CREATE VIEW `v_material_folder_count` AS
SELECT
  f.`openid`,
  f.`id`   AS `folder_id`,
  f.`name` AS `folder_name`,
  f.`cover_material_id`,
  COUNT(m.`id`) AS `material_count`
FROM `material_folder` f
LEFT JOIN `material` m
  ON m.`folder_id` = f.`id` AND m.`openid` = f.`openid` AND m.`deleted_at` IS NULL
WHERE f.`deleted_at` IS NULL
GROUP BY f.`openid`, f.`id`, f.`name`, f.`cover_material_id`;

-- -----------------------------------------------------------------------------
-- v_trash —— 回收站（30 天内可恢复的软删除记录）
--   对应「我的 → 回收站」里恢复最近一条的功能
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_trash`;
CREATE VIEW `v_trash` AS
SELECT
  'check_in' AS `entity_type`,
  `id`,
  `openid`,
  `date`   AS `sort_date`,
  `deleted_at`,
  TIMESTAMPDIFF(DAY, `deleted_at`, UTC_TIMESTAMP()) AS `days_ago`
FROM `check_in`
WHERE `deleted_at` IS NOT NULL
UNION ALL
SELECT
  'material' AS `entity_type`,
  `id`,
  `openid`,
  `created_at` AS `sort_date`,
  `deleted_at`,
  TIMESTAMPDIFF(DAY, `deleted_at`, UTC_TIMESTAMP()) AS `days_ago`
FROM `material`
WHERE `deleted_at` IS NOT NULL;

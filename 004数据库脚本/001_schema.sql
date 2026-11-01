-- =============================================================================
-- 捏土打卡 · 数据库表结构
-- 数据库：MySQL 8.0.16+ / InnoDB / utf8mb4
-- 对应 PRD：捏土打卡小程序-PRD.md V1.2 §6 数据模型设计
-- 对应前端：001/utils/db.js（字段一一映射，见 README 的字段对照表）
--
-- ★ 主键约定（全库统一）
--   内置造型的 id 对【每个账号都叫 shape_ob11】，内置标签同理；
--   客户端生成的 id 也不带账号前缀，理论上两个账号可能在同一毫秒撞号。
--   所以所有业务表统一用 (openid, id) 作复合主键，
--   外键也带 openid 一起引用，唯一且不会有跨账号串数据。
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `nietu_daka`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE `nietu_daka`;

-- =============================================================================
-- 1. account —— 微信账号
--    注册是隐式的：服务端第一次见到 openid 就建号（PRD §5.6.2）
--    游客模式没有这张表的行；客户端只在登录成功后才有 openid
-- =============================================================================
DROP TABLE IF EXISTS `account`;
CREATE TABLE `account` (
  `openid`        VARCHAR(64)  NOT NULL                COMMENT '微信用户标识（主键）。服务端由 code 换取，客户端不存 session_key',
  `unionid`       VARCHAR(64)  DEFAULT NULL            COMMENT '同一开放平台下打通，可空',
  `nickname`      VARCHAR(64)  DEFAULT NULL            COMMENT '昵称，用户主动填写，可空',
  `avatar_url`    VARCHAR(512) DEFAULT NULL            COMMENT '头像地址，用户主动选择，可空',
  `data_scope`    ENUM('cloud','local') NOT NULL DEFAULT 'cloud'
                                                              COMMENT 'cloud=数据在云端；local=数据只在本机，账号仅用于身份',
  `created_at`    DATETIME(3)  NOT NULL                COMMENT '首次登录即注册的时间',
  `last_login_at` DATETIME(3)  NOT NULL                COMMENT '最近一次登录时间',
  PRIMARY KEY (`openid`),
  KEY `idx_account_unionid` (`unionid`),
  KEY `idx_account_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='微信账号';

-- =============================================================================
-- 2. device —— 登录过的设备
--    用于跨设备合并与冲突检测（PRD §5.6.2 / §8.2）
-- =============================================================================
DROP TABLE IF EXISTS `device`;
CREATE TABLE `device` (
  `openid`       VARCHAR(64) NOT NULL             COMMENT '所属账号',
  `id`           VARCHAR(64) NOT NULL             COMMENT '设备标识，客户端首次安装生成（含随机串，全局唯一）',
  `device_name`  VARCHAR(128) DEFAULT NULL        COMMENT '设备备注（机型等）',
  `last_sync_at` DATETIME(3) DEFAULT NULL        COMMENT '最近一次同步时间（增量拉取的游标）',
  `pushed_count` INT         NOT NULL DEFAULT 0   COMMENT '已上传的记录数，用于合并进度提示',
  `created_at`   DATETIME(3) NOT NULL,
  `updated_at`   DATETIME(3) NOT NULL,
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_device_id` (`id`),
  CONSTRAINT `fk_device_account` FOREIGN KEY (`openid`) REFERENCES `account` (`openid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='登录过的设备';

-- =============================================================================
-- 3. shape —— 造型分类
--    内置分类每个账号各存一份（用户可改名/改色/改价/改排序），
--    所以 id 在账号内唯一即可，主键带 openid。
--    slot 是色槽位：图表配色按槽位固定分配，不按排名重新着色。
-- =============================================================================
DROP TABLE IF EXISTS `shape`;
CREATE TABLE `shape` (
  `openid`        VARCHAR(64)   NOT NULL              COMMENT '所属账号',
  `id`            VARCHAR(64)   NOT NULL              COMMENT '分类 id。内置为 shape_ob11 / shape_qq / shape_zhengbi / shape_other',
  `name`          VARCHAR(32)   NOT NULL              COMMENT '名称，如 OB11娃头 / QQ人 / 正比 / 其他',
  `icon`          VARCHAR(16)   NOT NULL DEFAULT ''   COMMENT 'emoji 图标，SVG 加载失败时的兜底',
  `icon_path`     VARCHAR(512)  DEFAULT NULL         COMMENT 'SVG 图标路径（包内路径），可空',
  `color`         VARCHAR(16)   NOT NULL DEFAULT ''   COMMENT '主题色 #RRGGBB',
  `slot`          TINYINT       NOT NULL DEFAULT 0    COMMENT '色槽位 0-7，图表配色按槽位固定分配',
  `default_price` DECIMAL(10,2) DEFAULT NULL         COMMENT '默认单价（元）',
  `default_cost`  DECIMAL(10,2) DEFAULT NULL         COMMENT '默认成本（元），P2 毛利分析预留',
  `sort`          INT           NOT NULL DEFAULT 0   COMMENT '排序',
  `is_builtin`    TINYINT(1)    NOT NULL DEFAULT 0   COMMENT '1=内置（不可删，可改名/改色/改排序）',
  `created_at`    DATETIME(3)   NOT NULL,
  `updated_at`    DATETIME(3)   NOT NULL,
  `deleted_at`    DATETIME(3)   DEFAULT NULL         COMMENT '软删除墓碑，回收站保留 30 天',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_shape_sort` (`openid`, `sort`),
  CONSTRAINT `fk_shape_account` FOREIGN KEY (`openid`) REFERENCES `account` (`openid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='造型分类';

-- =============================================================================
-- 4. tag —— 标签
-- =============================================================================
DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `openid`     VARCHAR(64)  NOT NULL            COMMENT '所属账号',
  `id`         VARCHAR(64)  NOT NULL            COMMENT '标签 id。内置为 tag_limit / tag_practice 等',
  `name`       VARCHAR(32)  NOT NULL            COMMENT '名称，如 限定配色 / 练手 / 送人',
  `color`      VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '主题色 #RRGGBB',
  `is_builtin` TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '1=内置（不可删，可改名）',
  `created_at` DATETIME(3)  NOT NULL,
  `updated_at` DATETIME(3)  NOT NULL,
  `deleted_at` DATETIME(3)  DEFAULT NULL       COMMENT '软删除墓碑',
  PRIMARY KEY (`openid`, `id`),
  CONSTRAINT `fk_tag_account` FOREIGN KEY (`openid`) REFERENCES `account` (`openid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='标签';

-- =============================================================================
-- 5. check_in —— 打卡记录
--    id 由客户端生成（ci_ 前缀），服务端不做主键生成，见 README「同步模型」
--    deleted_at 取代 PRD 的 status 枚举：回收站需要知道「何时删的」才能做 30 天清理
--    口径等价：status='normal' ⟺ deleted_at IS NULL
-- =============================================================================
DROP TABLE IF EXISTS `check_in`;
CREATE TABLE `check_in` (
  `openid`         VARCHAR(64)  NOT NULL              COMMENT '所属账号',
  `id`             VARCHAR(64)  NOT NULL              COMMENT '主键，客户端生成（ci_ 前缀）',
  `date`           DATE         NOT NULL              COMMENT '打卡日期（本地日期）。产量的统计归属键',
  `shape_id`       VARCHAR(64)  NOT NULL              COMMENT '造型分类 id',
  `count`          INT          NOT NULL DEFAULT 1    COMMENT '数量 1-99',
  `cover_photo_id` VARCHAR(64)  DEFAULT NULL         COMMENT '封面照片 id，冗余存储便于列表直接取封面',
  `note`           VARCHAR(200) NOT NULL DEFAULT ''   COMMENT '打卡笔记',
  `duration_min`   INT          DEFAULT NULL         COMMENT '耗时（分钟），可空',
  `device_id`      VARCHAR(64)  DEFAULT NULL         COMMENT '最后写入该行的设备',
  `created_at`     DATETIME(3)  NOT NULL,
  `updated_at`     DATETIME(3)  NOT NULL              COMMENT '同步冲突判定依据：后写覆盖先写（PRD §8.2）',
  `deleted_at`     DATETIME(3)  DEFAULT NULL         COMMENT '软删除墓碑，NULL=正常',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_check_in_user_date` (`openid`, `date`),
  KEY `idx_check_in_user_updated` (`openid`, `updated_at`),
  KEY `idx_check_in_shape` (`openid`, `shape_id`),
  KEY `idx_check_in_device` (`openid`, `device_id`),
  CONSTRAINT `fk_check_in_account` FOREIGN KEY (`openid`) REFERENCES `account` (`openid`) ON DELETE CASCADE,
  CONSTRAINT `fk_check_in_shape`   FOREIGN KEY (`openid`, `shape_id`) REFERENCES `shape` (`openid`, `id`) ON DELETE RESTRICT,
  -- RESTRICT 而非 SET NULL：SET NULL 会把 openid 一起置空（NOT NULL 冲突），
  -- 且删设备不该连带删掉打卡记录
  CONSTRAINT `fk_check_in_device`  FOREIGN KEY (`openid`, `device_id`) REFERENCES `device` (`openid`, `id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='打卡记录';

-- =============================================================================
-- 6. check_in_tag —— 打卡 × 标签 多对多
--    客户端把标签存成 check_in.tagIds 数组，同步时展开成这张表
-- =============================================================================
DROP TABLE IF EXISTS `check_in_tag`;
CREATE TABLE `check_in_tag` (
  `openid`      VARCHAR(64) NOT NULL       COMMENT '所属账号',
  `check_in_id` VARCHAR(64) NOT NULL       COMMENT '打卡记录 id',
  `tag_id`      VARCHAR(64) NOT NULL       COMMENT '标签 id',
  `created_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`check_in_id`, `tag_id`),
  KEY `idx_cit_openid` (`openid`),
  KEY `idx_cit_tag` (`openid`, `tag_id`),
  CONSTRAINT `fk_cit_check_in` FOREIGN KEY (`openid`, `check_in_id`) REFERENCES `check_in` (`openid`, `id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cit_tag`      FOREIGN KEY (`openid`, `tag_id`)      REFERENCES `tag` (`openid`, `id`)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='打卡与标签的多对多关系';

-- =============================================================================
-- 7. photo —— 打卡照片
-- =============================================================================
DROP TABLE IF EXISTS `photo`;
CREATE TABLE `photo` (
  `openid`      VARCHAR(64)   NOT NULL            COMMENT '所属账号',
  `id`          VARCHAR(64)   NOT NULL            COMMENT '主键，客户端生成（ph_ 前缀）',
  `check_in_id` VARCHAR(64)   NOT NULL            COMMENT '关联打卡记录',
  `url`         VARCHAR(1024) NOT NULL            COMMENT '图片地址（对象存储 URL 或小程序临时地址）',
  `local_path`  VARCHAR(1024) DEFAULT NULL       COMMENT '仅客户端有意义的本地持久化路径，云端可空',
  `width`       INT           NOT NULL DEFAULT 0  COMMENT '宽，用于瀑布流布局',
  `height`      INT           NOT NULL DEFAULT 0  COMMENT '高，用于瀑布流布局',
  `sort`        INT           NOT NULL DEFAULT 0  COMMENT '排序，0 为封面',
  `created_at`  DATETIME(3)   NOT NULL,
  `updated_at`  DATETIME(3)   NOT NULL,
  `deleted_at`  DATETIME(3)   DEFAULT NULL       COMMENT '软删除墓碑',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_photo_check_in` (`openid`, `check_in_id`),
  KEY `idx_photo_user_updated` (`openid`, `updated_at`),
  CONSTRAINT `fk_photo_check_in` FOREIGN KEY (`openid`, `check_in_id`) REFERENCES `check_in` (`openid`, `id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='打卡照片';

-- =============================================================================
-- 8. sale —— 售出记录
--    total_amount 冗余存储，便于统计（PRD §6.2）
--    sold_date 是营收的统计归属键，与 check_in.date 不同——这是最容易算错的地方
--    追加型：同步时只插入不做覆盖合并（PRD §8.2）
-- =============================================================================
DROP TABLE IF EXISTS `sale`;
CREATE TABLE `sale` (
  `openid`       VARCHAR(64)   NOT NULL               COMMENT '所属账号',
  `id`           VARCHAR(64)   NOT NULL               COMMENT '主键，客户端生成（sale_ 前缀）',
  `check_in_id`  VARCHAR(64)   NOT NULL               COMMENT '关联打卡记录',
  `quantity`     INT           NOT NULL DEFAULT 1     COMMENT '售出数量',
  `unit_price`   DECIMAL(10,2) NOT NULL DEFAULT 0.00  COMMENT '单价（元）',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00  COMMENT '金额 = quantity × unit_price，冗余存储便于统计',
  `sold_date`    DATE          NOT NULL               COMMENT '售出日期。营收的统计归属键（≠ check_in.date）',
  `channel`      ENUM('xhs','xianyu','wechat','offline','other')
                                NOT NULL DEFAULT 'other'
                                COMMENT '销售渠道，取值与 001/utils/constants.js 的 CHANNELS[].id 一致',
                                -- 注意：枚举值必须和代码里的 id 完全一致（xhs 不是 xiaohongshu），
                                -- 否则客户端写入会被截断报错
  `note`         VARCHAR(100)  NOT NULL DEFAULT ''    COMMENT '备注',
  `device_id`    VARCHAR(64)   DEFAULT NULL          COMMENT '最后写入该行的设备',
  `created_at`   DATETIME(3)   NOT NULL,
  `updated_at`   DATETIME(3)   NOT NULL,
  `deleted_at`   DATETIME(3)   DEFAULT NULL          COMMENT '软删除墓碑',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_sale_user_sold_date` (`openid`, `sold_date`),
  KEY `idx_sale_check_in` (`openid`, `check_in_id`),
  KEY `idx_sale_user_updated` (`openid`, `updated_at`),
  CONSTRAINT `fk_sale_check_in` FOREIGN KEY (`openid`, `check_in_id`) REFERENCES `check_in` (`openid`, `id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='售出记录';

-- =============================================================================
-- 9. material_folder —— 素材文件夹
--    删除文件夹不删素材：应用层先把 material.folder_id 置 NULL 再删文件夹
--    （外键是 RESTRICT 而不是 SET NULL——SET NULL 会把 openid 一起置空）
-- =============================================================================
DROP TABLE IF EXISTS `material_folder`;
CREATE TABLE `material_folder` (
  `openid`            VARCHAR(64)  NOT NULL            COMMENT '所属账号',
  `id`                VARCHAR(64)  NOT NULL            COMMENT '主键，客户端生成（mf_ 前缀）',
  `name`              VARCHAR(20)  NOT NULL            COMMENT '文件夹名',
  `cover_material_id` VARCHAR(64)  DEFAULT NULL       COMMENT '封面素材 id，默认取该文件夹第一张图',
  `sort`              INT          NOT NULL DEFAULT 0  COMMENT '排序',
  `created_at`        DATETIME(3)  NOT NULL,
  `updated_at`        DATETIME(3)  NOT NULL,
  `deleted_at`        DATETIME(3)  DEFAULT NULL       COMMENT '软删除墓碑',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_mf_sort` (`openid`, `sort`),
  CONSTRAINT `fk_mf_account` FOREIGN KEY (`openid`) REFERENCES `account` (`openid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='素材文件夹';

-- =============================================================================
-- 10. material —— 素材
--     folder_id 为 NULL 表示未分类（客户端用空字符串，同步时转 NULL）
-- =============================================================================
DROP TABLE IF EXISTS `material`;
CREATE TABLE `material` (
  `openid`     VARCHAR(64)   NOT NULL              COMMENT '所属账号',
  `id`         VARCHAR(64)   NOT NULL              COMMENT '主键，客户端生成（mt_ 前缀）',
  `folder_id`  VARCHAR(64)   DEFAULT NULL         COMMENT '所属文件夹，NULL=未分类',
  `url`        VARCHAR(1024) NOT NULL              COMMENT '图片地址',
  `local_path` VARCHAR(1024) DEFAULT NULL         COMMENT '仅客户端有意义的本地持久化路径，云端可空',
  `name`       VARCHAR(64)   NOT NULL DEFAULT ''   COMMENT '名称，默认「素材 N」',
  `note`       VARCHAR(100)  NOT NULL DEFAULT ''   COMMENT '备注',
  `created_at` DATETIME(3)   NOT NULL,
  `updated_at` DATETIME(3)   NOT NULL,
  `deleted_at` DATETIME(3)   DEFAULT NULL         COMMENT '软删除墓碑，回收站保留 30 天',
  PRIMARY KEY (`openid`, `id`),
  KEY `idx_material_folder` (`openid`, `folder_id`),
  KEY `idx_material_user_updated` (`openid`, `updated_at`),
  CONSTRAINT `fk_material_folder` FOREIGN KEY (`openid`, `folder_id`) REFERENCES `material_folder` (`openid`, `id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='素材';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 业务约束（MySQL 8.0.16+ 才会真正生效，更早版本会被解析后忽略）
-- =============================================================================
ALTER TABLE `check_in`
  ADD CONSTRAINT `ck_check_in_count` CHECK (`count` BETWEEN 1 AND 99),
  ADD CONSTRAINT `ck_check_in_note`  CHECK (CHAR_LENGTH(`note`) <= 200);

ALTER TABLE `sale`
  ADD CONSTRAINT `ck_sale_quantity` CHECK (`quantity` > 0),
  ADD CONSTRAINT `ck_sale_price`    CHECK (`unit_price` >= 0 AND `total_amount` >= 0);

ALTER TABLE `material_folder`
  ADD CONSTRAINT `ck_mf_name` CHECK (CHAR_LENGTH(`name`) BETWEEN 1 AND 20);

ALTER TABLE `material`
  ADD CONSTRAINT `ck_material_note` CHECK (CHAR_LENGTH(`note`) <= 100);

ALTER TABLE `shape`
  ADD CONSTRAINT `ck_shape_slot` CHECK (`slot` BETWEEN 0 AND 7),
  ADD CONSTRAINT `ck_shape_name` CHECK (CHAR_LENGTH(`name`) BETWEEN 1 AND 32);

ALTER TABLE `tag`
  ADD CONSTRAINT `ck_tag_name` CHECK (CHAR_LENGTH(`name`) BETWEEN 1 AND 32);

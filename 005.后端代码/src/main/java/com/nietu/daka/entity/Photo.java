package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 打卡照片。sort=0 是封面。
 *
 * <p>对应表 {@code photo}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("photo")
public class Photo {

    /** 所属账号 */
    private String openid;

    /** 主键，客户端生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 关联打卡记录 */
    private String checkInId;

    /** 图片地址 */
    private String url;

    /** 仅客户端有意义的本地路径 */
    private String localPath;

    /** 宽，瀑布流布局用 */
    private Integer width;

    /** 高，瀑布流布局用 */
    private Integer height;

    /** 排序 */
    private Integer sort;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

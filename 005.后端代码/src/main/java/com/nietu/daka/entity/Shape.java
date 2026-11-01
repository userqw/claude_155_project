package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 造型分类。内置分类每个账号各存一份，用户可改名改色改价。
 *
 * <p>对应表 {@code shape}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("shape")
public class Shape {

    /** 所属账号 */
    private String openid;

    /** 分类 id，内置为 shape_ob11 等 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 名称 */
    private String name;

    /** emoji 图标，SVG 加载失败时的兜底 */
    private String icon;

    /** SVG 图标路径，可空 */
    private String iconPath;

    /** 主题色 #RRGGBB */
    private String color;

    /** 色槽位 0-7，图表配色按槽位固定分配 */
    private Integer slot;

    /** 默认单价 */
    private BigDecimal defaultPrice;

    /** 默认成本，P2 预留 */
    private BigDecimal defaultCost;

    /** 排序 */
    private Integer sort;

    /** 1=内置，不可删 */
    private Integer isBuiltin;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

package com.nietu.daka.dto;


/**
 * 造型分布行（v_shape_distribution）。
 */
public record ShapeDistributionRow(
    /** 年份 */
    int year,
    /** 分类 id */
    String shapeId,
    /** 分类名 */
    String shapeName,
    /** 图标 */
    String shapeIcon,
    /** 主题色 */
    String shapeColor,
    /** 色槽位 */
    Integer shapeSlot,
    /** 产量 */
    Long production
) {
}

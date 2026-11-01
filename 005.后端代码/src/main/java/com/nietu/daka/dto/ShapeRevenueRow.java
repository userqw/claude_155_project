package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 按造型的结缘金（v_shape_revenue）。
 */
public record ShapeRevenueRow(
    /** 年份 */
    int year,
    /** 分类 id */
    String shapeId,
    /** 分类名 */
    String shapeName,
    /** 主题色 */
    String shapeColor,
    /** 结缘金 */
    BigDecimal revenue,
    /** 售出数量 */
    Long soldCount,
    /** 单件均价 */
    BigDecimal avgPrice
) {
}

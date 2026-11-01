package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 造型分类。
 */
public record ShapeDto(
    /** 分类 id */
    String id,
    /** 名称 */
    String name,
    /** emoji */
    String icon,
    /** SVG 路径 */
    String iconPath,
    /** 主题色 */
    String color,
    /** 色槽位 */
    Integer slot,
    /** 默认单价 */
    BigDecimal defaultPrice,
    /** 排序 */
    Integer sort,
    /** 1=内置 */
    Integer isBuiltin
) {
}

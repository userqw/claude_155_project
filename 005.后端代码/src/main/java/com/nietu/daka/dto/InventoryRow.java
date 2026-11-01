package com.nietu.daka.dto;


/**
 * 库存行（v_inventory）。累计口径，跨年结转。
 */
public record InventoryRow(
    /** 分类 id */
    String shapeId,
    /** 分类名 */
    String shapeName,
    /** 主题色 */
    String shapeColor,
    /** 累计做了 */
    Long made,
    /** 累计卖了 */
    Long sold,
    /** 剩余库存 */
    Long stock
) {
}

package com.nietu.daka.dto;

import com.nietu.daka.entity.Shape;

import java.math.BigDecimal;

/**
 * 品类（造型）出参。
 *
 * <p>不直接返回 Entity：数据库加字段不应该等于接口变更（规范 API-02）。
 */
public record ShapeVo(
        /** 品类 id */
        String id,
        /** 名称 */
        String name,
        /** emoji 图标 */
        String icon,
        /** svg 图标路径（有则优先用 svg） */
        String iconPath,
        /** 主题色 */
        String color,
        /** 色槽 0~7 */
        Integer slot,
        /** 默认单价，选填 */
        BigDecimal defaultPrice,
        /** 是否内置。内置的可改名、可排序、不可删 */
        Boolean builtin,
        /** 用这个品类的记录累计数量 */
        Integer used
) {

    public static ShapeVo of(Shape shape, int used) {
        return new ShapeVo(
                shape.getId(),
                shape.getName(),
                shape.getIcon(),
                shape.getIconPath(),
                shape.getColor(),
                shape.getSlot(),
                shape.getDefaultPrice(),
                shape.getIsBuiltin() != null && shape.getIsBuiltin() == 1,
                used
        );
    }
}

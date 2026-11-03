package com.nietu.daka.dto;

import com.nietu.daka.entity.Tag;

/**
 * 标签出参。
 */
public record TagVo(
        /** 标签 id */
        String id,
        /** 名称 */
        String name,
        /** 颜色 */
        String color,
        /** 是否内置。内置的不可删 */
        Boolean builtin,
        /** 用这个标签的记录条数 */
        Integer used
) {

    public static TagVo of(Tag tag, int used) {
        return new TagVo(
                tag.getId(),
                tag.getName(),
                tag.getColor(),
                tag.getIsBuiltin() != null && tag.getIsBuiltin() == 1,
                used
        );
    }
}

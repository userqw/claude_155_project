package com.nietu.daka.dto;


/**
 * 标签。
 */
public record TagDto(
    /** 标签 id */
    String id,
    /** 名称 */
    String name,
    /** 主题色 */
    String color,
    /** 1=内置 */
    Integer isBuiltin
) {
}

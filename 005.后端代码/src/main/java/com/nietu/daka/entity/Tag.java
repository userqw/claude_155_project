package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 标签。
 *
 * <p>对应表 {@code tag}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("tag")
public class Tag {

    /** 所属账号 */
    private String openid;

    /** 标签 id */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 名称 */
    private String name;

    /** 主题色 */
    private String color;

    /** 1=内置，不可删 */
    private Integer isBuiltin;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

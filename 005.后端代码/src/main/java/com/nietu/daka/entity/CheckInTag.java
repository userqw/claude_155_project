package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 打卡与标签的多对多关系。客户端存的是 tagIds 数组。
 *
 * <p>对应表 {@code check_in_tag}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("check_in_tag")
public class CheckInTag {

    /** 所属账号 */
    private String openid;

    /** 打卡记录 id */
    @TableId(value = "check_in_id", type = IdType.INPUT)
    private String checkInId;

    /** 标签 id */
    private String tagId;

    /** 创建时间 */
    private LocalDateTime createdAt;
}

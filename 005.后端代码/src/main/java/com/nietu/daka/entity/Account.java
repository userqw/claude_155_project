package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 微信账号。注册是隐式的：服务端第一次见到 openid 就建号。
 *
 * <p>对应表 {@code account}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("account")
public class Account {

    /** 微信用户标识（主键） */
    @TableId(value = "openid", type = IdType.INPUT)
    private String openid;

    /** 同一开放平台下打通，可空 */
    private String unionid;

    /** 昵称，用户主动填写，可空 */
    private String nickname;

    /** 头像地址，可空 */
    private String avatarUrl;

    /** cloud=数据在云端；local=数据只在本机 */
    private String dataScope;

    /** 首次登录即注册的时间 */
    private LocalDateTime createdAt;

    /** 最近一次登录时间 */
    private LocalDateTime lastLoginAt;
}

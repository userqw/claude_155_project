package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 登录过的设备。lastSyncAt 是增量拉取的游标。
 *
 * <p>对应表 {@code device}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("device")
public class Device {

    /** 设备标识，客户端首次安装生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 所属账号 */
    private String openid;

    /** 设备备注 */
    private String deviceName;

    /** 最近一次同步时间 */
    private LocalDateTime lastSyncAt;

    /** 已上传的记录数 */
    private Integer pushedCount;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;
}

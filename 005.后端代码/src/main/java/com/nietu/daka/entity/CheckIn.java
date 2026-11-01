package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 打卡记录。date 是【产量】的统计归属键。
 *
 * <p>对应表 {@code check_in}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("check_in")
public class CheckIn {

    /** 所属账号 */
    private String openid;

    /** 主键，客户端生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 打卡日期 */
    private LocalDate date;

    /** 造型分类 id */
    private String shapeId;

    /** 数量 1-99 */
    private Integer count;

    /** 封面照片 id */
    private String coverPhotoId;

    /** 打卡笔记 */
    private String note;

    /** 耗时（分钟） */
    private Integer durationMin;

    /** 最后写入该行的设备 */
    private String deviceId;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间，同步冲突判定依据 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

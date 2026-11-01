package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 售出记录。soldDate 是【营收】的统计归属键，与 check_in.date 不同。
 *
 * <p>对应表 {@code sale}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("sale")
public class Sale {

    /** 所属账号 */
    private String openid;

    /** 主键，客户端生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 关联打卡记录 */
    private String checkInId;

    /** 售出数量 */
    private Integer quantity;

    /** 单价 */
    private BigDecimal unitPrice;

    /** 金额，冗余存储便于统计 */
    private BigDecimal totalAmount;

    /** 售出日期 */
    private LocalDate soldDate;

    /** 销售渠道：xhs / xianyu / wechat / offline / other */
    private String channel;

    /** 备注 */
    private String note;

    /** 最后写入该行的设备 */
    private String deviceId;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 素材。folderId 为空表示未分类。
 *
 * <p>对应表 {@code material}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("material")
public class Material {

    /** 所属账号 */
    private String openid;

    /** 主键，客户端生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 所属文件夹，空 = 未分类 */
    private String folderId;

    /** 图片地址 */
    private String url;

    /** 仅客户端有意义的本地路径 */
    private String localPath;

    /** 名称，默认「素材 N」 */
    private String name;

    /** 备注 */
    private String note;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

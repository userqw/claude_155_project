package com.nietu.daka.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 素材文件夹。删除文件夹不删素材，素材会转为未分类。
 *
 * <p>对应表 {@code material_folder}，字段与 004数据库脚本/001_schema.sql 一一对应。
 */
@Data
@TableName("material_folder")
public class MaterialFolder {

    /** 所属账号 */
    private String openid;

    /** 主键，客户端生成 */
    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    /** 文件夹名 */
    private String name;

    /** 封面素材 id */
    private String coverMaterialId;

    /** 排序 */
    private Integer sort;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 软删除墓碑 */
    private LocalDateTime deletedAt;
}

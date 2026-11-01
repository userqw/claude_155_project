package com.nietu.daka.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
/**
 * 打卡记录（同步与普通增删改共用）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CheckInDto(
    /** 客户端生成的 id */
    String id,
    /** 打卡日期 */
    LocalDate date,
    /** 造型分类 id */
    String shapeId,
    /** 数量 */
    Integer count,
    /** 笔记 */
    String note,
    /** 耗时（分钟） */
    Integer durationMin,
    /** 封面照片 id */
    String coverPhotoId,
    /** 标签 id 列表 */
    List<String> tagIds,
    /** 照片 */
    List<PhotoDto> photos,
    /** 售出记录 */
    List<SaleDto> sales,
    /** 是否已删除（软删除墓碑） */
    Boolean deleted,
    /** 客户端最后修改时间，同步合并判定依据 */
    LocalDateTime updatedAt,
    /** 客户端的软删除标记（字段名与前端 db.js 的 deletedAt 一致） */
    String deletedAt
) {
}

package com.nietu.daka.dto;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


/**
 * 照片。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PhotoDto(
    /** 客户端生成的 id */
    String id,
    /** 图片地址 */
    String url,
    /** 仅客户端有意义的本地路径 */
    String localPath,
    /** 宽 */
    Integer width,
    /** 高 */
    Integer height,
    /** 排序，0 为封面 */
    Integer sort,
    /** 客户端最后修改时间 */
    LocalDateTime updatedAt,
    /** 关联的打卡记录 id（顶层上传照片时必带） */
    String checkInId
) {
}

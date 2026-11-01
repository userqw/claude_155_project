package com.nietu.daka.dto;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


/**
 * 素材文件夹。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FolderDto(
    /** 客户端生成的 id */
    String id,
    /** 名称 */
    String name,
    /** 排序 */
    Integer sort,
    /** 封面素材 id */
    String coverMaterialId,
    /** 客户端最后修改时间 */
    LocalDateTime updatedAt
) {
}

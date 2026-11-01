package com.nietu.daka.dto;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


/**
 * 素材。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MaterialDto(
    /** 客户端生成的 id */
    String id,
    /** 所属文件夹，空 = 未分类 */
    String folderId,
    /** 图片地址 */
    String url,
    /** 仅客户端有意义的本地路径 */
    String localPath,
    /** 名称 */
    String name,
    /** 备注 */
    String note,
    /** 客户端最后修改时间 */
    LocalDateTime updatedAt
) {
}

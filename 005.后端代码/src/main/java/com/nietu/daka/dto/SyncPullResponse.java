package com.nietu.daka.dto;

import java.util.List;
import java.time.LocalDateTime;
/**
 * 拉取响应。
 */
public record SyncPullResponse(
    /** 服务端时间，客户端可作为下次拉取的游标基准 */
    LocalDateTime serverTime,
    /** 增量打卡记录 */
    List<CheckInDto> checkIns,
    /** 增量售出记录 */
    List<SaleDto> sales,
    /** 增量照片 */
    List<PhotoDto> photos,
    /** 增量素材文件夹 */
    List<FolderDto> folders,
    /** 增量素材 */
    List<MaterialDto> materials,
    /** 造型分类 */
    List<ShapeDto> shapes,
    /** 标签 */
    List<TagDto> tags
) {
}

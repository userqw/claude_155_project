package com.nietu.daka.dto;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
/**
 * 推送请求（PRD §5.6.2 的 /api/sync/push）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SyncPushRequest(
    /** 设备标识 */
    String deviceId,
    /** 打卡记录 */
    List<CheckInDto> checkIns,
    /** 售出记录 */
    List<SaleDto> sales,
    /** 照片 */
    List<PhotoDto> photos,
    /** 素材文件夹 */
    List<FolderDto> folders,
    /** 素材 */
    List<MaterialDto> materials,
    /** 造型分类（服务端以账号内的副本为准，这里只做接收） */
    List<ShapeDto> shapes,
    /** 标签（同上） */
    List<TagDto> tags
) {
}

package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 打卡记录的新增/修改入参（面向接口调用方）。
 *
 * <p>与 {@code CheckInDto}（同步协议用）分开：同步要兼容各种历史客户端，
 * 校验必须松；这里是对外的接口契约，该拦的都拦（规范 API-03）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CheckInRequest(
        /** 客户端生成的 id。留空则由服务端生成 */
        @Size(max = 64, message = "id 过长")
        String id,

        /** 打卡日期 */
        @NotNull(message = "选一下日期")
        LocalDate date,

        /** 品类 id */
        @NotBlank(message = "选一个品类")
        @Size(max = 64, message = "品类 id 过长")
        String shapeId,

        /** 数量 */
        @NotNull(message = "填一下做了几个")
        @Min(value = 1, message = "数量要大于 0")
        @Max(value = 999, message = "数量太大了")
        Integer count,

        /** 备注 */
        @Size(max = 200, message = "备注最多 200 字")
        String note,

        /** 耗时（分钟） */
        @Min(value = 0, message = "耗时不能是负数")
        @Max(value = 1440, message = "耗时最多一天")
        Integer durationMin,

        /** 封面照片 id */
        @Size(max = 64, message = "照片 id 过长")
        String coverPhotoId,

        /** 标签 id 列表 */
        List<String> tagIds,

        /** 照片 */
        List<PhotoDto> photos
) {

    /** 转成服务层用的同步 DTO */
    public CheckInDto toDto() {
        return new CheckInDto(
                id, date, shapeId, count, note, durationMin, coverPhotoId,
                tagIds, photos, null, false, null, null
        );
    }
}

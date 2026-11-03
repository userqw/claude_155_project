package com.nietu.daka.dto;

import com.nietu.daka.entity.CheckIn;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 打卡记录出参。
 *
 * <p>不直接返回 Entity（规范 API-02）：实体里有 {@code deviceId}、{@code deletedAt}
 * 这些属于内部实现或软删除状态的字段，不该出现在对外契约里。
 *
 * @param id         记录 id
 * @param date       打卡日期（产量按这个日期归属，PRD §6.3）
 * @param shapeId    品类 id
 * @param shapeName  品类名，出参时带上前端不用再查一次
 * @param count      数量
 * @param note       备注
 * @param durationMin 耗时（分钟）
 * @param coverPhotoId 封面照片 id
 * @param soldCount  已售出数量
 * @param unsold     未售出数量 = 数量 − 已售出
 * @param createdAt  创建时间
 * @param updatedAt  最后修改时间
 */
public record CheckInVo(
        String id,
        LocalDate date,
        String shapeId,
        String shapeName,
        Integer count,
        String note,
        Integer durationMin,
        String coverPhotoId,
        Integer soldCount,
        Integer unsold,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    public static CheckInVo of(CheckIn row, String shapeName, int soldCount) {
        int count = row.getCount() == null ? 0 : row.getCount();
        return new CheckInVo(
                row.getId(),
                row.getDate(),
                row.getShapeId(),
                shapeName,
                count,
                row.getNote(),
                row.getDurationMin(),
                row.getCoverPhotoId(),
                soldCount,
                Math.max(0, count - soldCount),
                row.getCreatedAt(),
                row.getUpdatedAt()
        );
    }
}

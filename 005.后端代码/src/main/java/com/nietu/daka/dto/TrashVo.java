package com.nietu.daka.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 回收站条目出参。
 *
 * <p>回收站保留 30 天（PRD §5.1.3），超过就由定时任务物理删除。
 *
 * @param entityType 'check_in' | 'material'
 * @param id         记录 id
 * @param title      展示用的标题（品类名 / 素材名）
 * @param subtitle   补充说明（数量 / 文件夹）
 * @param cover      封面图，素材才有
 * @param sortDate   排序用的日期（打卡用打卡日，素材用创建日）
 * @param deletedAt  删除时间
 * @param daysAgo    已经过了几天（按 UTC 计算）
 */
public record TrashVo(
        String entityType,
        String id,
        String title,
        String subtitle,
        String cover,
        LocalDate sortDate,
        LocalDateTime deletedAt,
        Integer daysAgo
) {
}

package com.nietu.daka.dto;

import java.math.BigDecimal;

/**
 * 跨年对比。
 *
 * <p>口径与前端 {@code stat.yearCompare()} 一致：比较两年的**产量**。
 *
 * @param year         当年
 * @param previousYear 上一年
 * @param current      当年产量
 * @param previous     上一年产量
 * @param delta        差值 = 当年 − 上一年
 * @param rate         变化百分比（一位小数）。上一年没有记录时为 null——
 *                     没有基数就不该给百分比
 * @param hasPrevious  上一年有没有记录
 */
public record YearCompareRow(
        int year,
        int previousYear,
        long current,
        long previous,
        long delta,
        BigDecimal rate,
        boolean hasPrevious
) {
}

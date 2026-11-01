package com.nietu.daka.dto;


/**
 * 月度产量行（v_monthly_production）。
 */
public record MonthlyProductionRow(
    /** 年份 */
    int year,
    /** 月份 */
    int month,
    /** 当月产量 */
    Long production,
    /** 当月有记录天数 */
    Long activeDays
) {
}

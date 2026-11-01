package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 月度营收行（v_monthly_revenue）。
 */
public record MonthlyRevenueRow(
    /** 年份 */
    int year,
    /** 月份 */
    int month,
    /** 当月营收 */
    BigDecimal revenue,
    /** 当月售出数量 */
    Long soldCount
) {
}

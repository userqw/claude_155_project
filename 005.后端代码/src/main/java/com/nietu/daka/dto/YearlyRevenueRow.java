package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 年度营收行（v_yearly_revenue）。营收按售出日归属。
 */
public record YearlyRevenueRow(
    /** 年份 */
    int year,
    /** 营收 */
    BigDecimal revenue,
    /** 售出数量 */
    Long soldCount
) {
}

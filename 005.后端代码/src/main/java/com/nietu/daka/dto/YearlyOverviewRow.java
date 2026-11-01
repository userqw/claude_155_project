package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 年度总览行（v_yearly_overview）。
 */
public record YearlyOverviewRow(
    /** 年份 */
    int year,
    /** 累计产量 */
    Long production,
    /** 打卡条数 */
    Long recordCount,
    /** 有记录的天数 */
    Long activeDays,
    /** 日均产出 */
    BigDecimal avgPerDay,
    /** 营收 */
    BigDecimal revenue,
    /** 售出数量 */
    Long soldCount,
    /** 未售出数量，负数已按 0 处理 */
    Long unsold,
    /** 1=售出数超过产量，跨年卖出或记录被删 */
    Integer oversold,
    /** 单件均价 */
    BigDecimal avgPrice
) {
}

package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 年度产量行（v_yearly_production）。
 */
public record YearlyProductionRow(
    /** 年份 */
    int year,
    /** 累计产量 */
    Long production,
    /** 打卡条数 */
    Long recordCount,
    /** 有记录的天数 */
    Long activeDays,
    /** 日均产出 = 产量 ÷ 有记录天数 */
    BigDecimal avgPerDay
) {
}

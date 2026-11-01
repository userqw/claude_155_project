package com.nietu.daka.dto;

import java.time.LocalDate;
/**
 * 逐日产量行（v_daily_production），日历热力图用。
 */
public record DailyProductionRow(
    /** 日期 */
    LocalDate date,
    /** 当日产量 */
    Long production
) {
}

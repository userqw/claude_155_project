package com.nietu.daka.service;

import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.ChannelRevenueRow;
import com.nietu.daka.dto.DailyProductionRow;
import com.nietu.daka.dto.InventoryRow;
import com.nietu.daka.dto.MonthlyProductionRow;
import com.nietu.daka.dto.MonthlyRevenueRow;
import com.nietu.daka.dto.ShapeDistributionRow;
import com.nietu.daka.dto.ShapeRevenueRow;
import com.nietu.daka.dto.YearlyOverviewRow;
import com.nietu.daka.dto.YearlyProductionRow;
import com.nietu.daka.dto.YearlyRevenueRow;
import com.nietu.daka.dto.YearCompareRow;
import com.nietu.daka.mapper.StatsMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * 统计查询。
 *
 * <p>口径全部来自 004数据库脚本/003_views.sql 的视图，
 * 与前端 utils/stat.js 的 yearlyOverview() 是同一套定义。
 */
@Service
public class StatsService {

    private final StatsMapper statsMapper;

    public StatsService(StatsMapper statsMapper) {
        this.statsMapper = statsMapper;
    }

    /**
     * 年度总览。
     *
     * <p>这一年没有记录时返回**全 0 的总览**，不是 404——
     * 「这一年没记录」是正常状态，前端要拿它渲染空态。
     */
    public YearlyOverviewRow overview(String openid, int year) {
        return statsMapper.yearlyOverview(openid).stream()
                .filter(r -> r.year() == year)
                .findFirst()
                .orElseGet(() -> emptyOverview(year));
    }

    /** 空年份的总览 */
    private YearlyOverviewRow emptyOverview(int year) {
        return new YearlyOverviewRow(year, 0L, 0L, 0L, BigDecimal.ZERO,
                BigDecimal.ZERO, 0L, 0L, 0, BigDecimal.ZERO);
    }

    /**
     * 跨年对比：与前端 {@code stat.yearCompare()} 同口径。
     *
     * <p>上一年没有记录时 {@code rate} 为 null——没有基数就不该给百分比。
     */
    public YearCompareRow compare(String openid, int year) {
        YearlyOverviewRow current = overview(openid, year);
        YearlyOverviewRow previous = overview(openid, year - 1);
        long cur = current.production() == null ? 0 : current.production();
        long prev = previous.production() == null ? 0 : previous.production();
        long delta = cur - prev;
        BigDecimal rate = prev > 0
                ? BigDecimal.valueOf(delta).multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(prev), 1, RoundingMode.HALF_UP)
                : null;
        return new YearCompareRow(year, year - 1, cur, prev, delta, rate, prev > 0);
    }

    public List<YearlyProductionRow> yearlyProduction(String openid) {
        return statsMapper.yearlyProduction(openid);
    }

    public List<YearlyRevenueRow> yearlyRevenue(String openid) {
        return statsMapper.yearlyRevenue(openid);
    }

    public List<MonthlyProductionRow> monthlyProduction(String openid, int year) {
        return statsMapper.monthlyProduction(openid, year);
    }

    public List<MonthlyRevenueRow> monthlyRevenue(String openid, int year) {
        return statsMapper.monthlyRevenue(openid, year);
    }

    public List<ShapeDistributionRow> shapeDistribution(String openid, int year) {
        return statsMapper.shapeDistribution(openid, year);
    }

    public List<ShapeRevenueRow> shapeRevenue(String openid, int year) {
        return statsMapper.shapeRevenue(openid, year);
    }

    public List<ChannelRevenueRow> channelRevenue(String openid, int year) {
        return statsMapper.channelRevenue(openid, year);
    }

    public List<InventoryRow> inventory(String openid) {
        return statsMapper.inventory(openid);
    }

    public List<DailyProductionRow> dailyProduction(String openid, int year) {
        return statsMapper.dailyProduction(openid, year);
    }
}

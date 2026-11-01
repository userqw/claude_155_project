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
import com.nietu.daka.mapper.StatsMapper;
import org.springframework.stereotype.Service;

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

    public YearlyOverviewRow overview(String openid, int year) {
        return statsMapper.yearlyOverview(openid).stream()
                .filter(r -> r.year() == year)
                .findFirst()
                .orElseThrow(() -> BizException.notFound("没有这一年的数据"));
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

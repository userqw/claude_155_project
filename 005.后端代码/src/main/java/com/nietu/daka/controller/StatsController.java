package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.ChannelRevenueRow;
import com.nietu.daka.dto.DailyProductionRow;
import com.nietu.daka.dto.InventoryRow;
import com.nietu.daka.dto.MonthlyProductionRow;
import com.nietu.daka.dto.MonthlyRevenueRow;
import com.nietu.daka.dto.ShapeDistributionRow;
import com.nietu.daka.dto.ShapeRevenueRow;
import com.nietu.daka.dto.YearlyOverviewRow;
import com.nietu.daka.dto.YearCompareRow;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 统计接口。
 *
 * <p>口径与前端 utils/stat.js 一致：产量按打卡日归属，营收按售出日归属。
 */
@Tag(name = "统计")
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @Operation(summary = "年度总览：产量、营收、未售出、日均")
    @GetMapping("/year")
    public Result<YearlyOverviewRow> year(@RequestParam int year) {
        return Result.ok(statsService.overview(AuthContext.require(), year));
    }

    @Operation(summary = "跨年对比（与上一年比产量）")
    @GetMapping("/compare")
    public Result<YearCompareRow> compare(@RequestParam int year) {
        return Result.ok(statsService.compare(AuthContext.require(), year));
    }

    @Operation(summary = "按月的产量")
    @GetMapping("/monthly-production")
    public Result<List<MonthlyProductionRow>> monthlyProduction(@RequestParam int year) {
        return Result.ok(statsService.monthlyProduction(AuthContext.require(), year));
    }

    @Operation(summary = "按月的营收")
    @GetMapping("/monthly-revenue")
    public Result<List<MonthlyRevenueRow>> monthlyRevenue(@RequestParam int year) {
        return Result.ok(statsService.monthlyRevenue(AuthContext.require(), year));
    }

    @Operation(summary = "造型分布（按年）")
    @GetMapping("/shapes")
    public Result<List<ShapeDistributionRow>> shapes(@RequestParam int year) {
        return Result.ok(statsService.shapeDistribution(AuthContext.require(), year));
    }

    @Operation(summary = "按造型的结缘金")
    @GetMapping("/shape-revenue")
    public Result<List<ShapeRevenueRow>> shapeRevenue(@RequestParam int year) {
        return Result.ok(statsService.shapeRevenue(AuthContext.require(), year));
    }

    @Operation(summary = "按渠道的结缘金")
    @GetMapping("/channel-revenue")
    public Result<List<ChannelRevenueRow>> channelRevenue(@RequestParam int year) {
        return Result.ok(statsService.channelRevenue(AuthContext.require(), year));
    }

    @Operation(summary = "库存（累计口径，跨年结转）")
    @GetMapping("/inventory")
    public Result<List<InventoryRow>> inventory() {
        return Result.ok(statsService.inventory(AuthContext.require()));
    }

    @Operation(summary = "逐日产量（日历热力图）")
    @GetMapping("/daily")
    public Result<List<DailyProductionRow>> daily(@RequestParam int year) {
        return Result.ok(statsService.dailyProduction(AuthContext.require(), year));
    }
}

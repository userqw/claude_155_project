package com.nietu.daka.mapper;

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
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 统计查询。
 *
 * <p>全部走 004数据库脚本/003_views.sql 里的视图——
 * PRD §6.3 的口径只有这一份实现，服务端和 BI 不会算出两个结果。
 */
@Mapper
public interface StatsMapper {

    @Select("SELECT `year`,`production`,`record_count`,`active_days`,`avg_per_day` "
            + "FROM v_yearly_production WHERE openid = #{openid} ORDER BY `year` DESC")
    List<YearlyProductionRow> yearlyProduction(@Param("openid") String openid);

    @Select("SELECT `year`,`revenue`,`sold_count` "
            + "FROM v_yearly_revenue WHERE openid = #{openid} ORDER BY `year` DESC")
    List<YearlyRevenueRow> yearlyRevenue(@Param("openid") String openid);

    @Select("SELECT `year`,`production`,`record_count`,`active_days`,`avg_per_day`,"
            + "`revenue`,`sold_count`,`unsold`,`oversold`,`avg_price` "
            + "FROM v_yearly_overview WHERE openid = #{openid} ORDER BY `year` DESC")
    List<YearlyOverviewRow> yearlyOverview(@Param("openid") String openid);

    @Select("SELECT `year`,`month`,`production`,`active_days` "
            + "FROM v_monthly_production WHERE openid = #{openid} AND `year` = #{year} ORDER BY `month`")
    List<MonthlyProductionRow> monthlyProduction(@Param("openid") String openid, @Param("year") int year);

    @Select("SELECT `year`,`month`,`revenue`,`sold_count` "
            + "FROM v_monthly_revenue WHERE openid = #{openid} AND `year` = #{year} ORDER BY `month`")
    List<MonthlyRevenueRow> monthlyRevenue(@Param("openid") String openid, @Param("year") int year);

    @Select("SELECT `year`,`shape_id`,`shape_name`,`shape_icon`,`shape_color`,`shape_slot`,`production` "
            + "FROM v_shape_distribution WHERE openid = #{openid} AND `year` = #{year} "
            + "ORDER BY `production` DESC")
    List<ShapeDistributionRow> shapeDistribution(@Param("openid") String openid, @Param("year") int year);

    @Select("SELECT `year`,`shape_id`,`shape_name`,`shape_color`,`revenue`,`sold_count`,`avg_price` "
            + "FROM v_shape_revenue WHERE openid = #{openid} AND `year` = #{year} ORDER BY `revenue` DESC")
    List<ShapeRevenueRow> shapeRevenue(@Param("openid") String openid, @Param("year") int year);

    @Select("SELECT `channel`,`revenue`,`sold_count` "
            + "FROM v_channel_revenue WHERE openid = #{openid} AND `year` = #{year} ORDER BY `revenue` DESC")
    List<ChannelRevenueRow> channelRevenue(@Param("openid") String openid, @Param("year") int year);

    @Select("SELECT `shape_id`,`shape_name`,`shape_color`,`made`,`sold`,`stock` "
            + "FROM v_inventory WHERE openid = #{openid} ORDER BY `made` DESC")
    List<InventoryRow> inventory(@Param("openid") String openid);

    @Select("SELECT `date`,`production` "
            + "FROM v_daily_production WHERE openid = #{openid} AND YEAR(`date`) = #{year} ORDER BY `date`")
    List<DailyProductionRow> dailyProduction(@Param("openid") String openid, @Param("year") int year);
}

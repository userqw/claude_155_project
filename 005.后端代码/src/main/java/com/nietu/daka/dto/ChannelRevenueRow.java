package com.nietu.daka.dto;

import java.math.BigDecimal;
/**
 * 按渠道的结缘金（v_channel_revenue）。
 */
public record ChannelRevenueRow(
    /** 渠道 id */
    String channel,
    /** 结缘金 */
    BigDecimal revenue,
    /** 售出数量 */
    Long soldCount
) {
}

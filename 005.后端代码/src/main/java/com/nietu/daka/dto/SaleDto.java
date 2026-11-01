package com.nietu.daka.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
/**
 * 售出记录。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SaleDto(
    /** 客户端生成的 id */
    String id,
    /** 关联打卡记录 */
    String checkInId,
    /** 数量 */
    Integer quantity,
    /** 单价 */
    BigDecimal unitPrice,
    /** 售出日期 */
    LocalDate soldDate,
    /** 渠道 */
    String channel,
    /** 备注 */
    String note,
    /** 客户端最后修改时间 */
    LocalDateTime updatedAt
) {
}

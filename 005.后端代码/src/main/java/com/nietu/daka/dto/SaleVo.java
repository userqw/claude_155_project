package com.nietu.daka.dto;

import com.nietu.daka.entity.Sale;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 售出记录出参。
 */
public record SaleVo(
        /** 售出记录 id */
        String id,
        /** 关联的打卡记录 id */
        String checkInId,
        /** 数量 */
        Integer quantity,
        /** 单价 */
        BigDecimal unitPrice,
        /** 总额 = 单价 × 数量 */
        BigDecimal totalAmount,
        /** 售出日期（营收按这个日期归属，PRD §6.3） */
        LocalDate soldDate,
        /** 销售渠道 */
        String channel,
        /** 备注 */
        String note,
        /** 创建时间 */
        LocalDateTime createdAt
) {

    public static SaleVo of(Sale sale) {
        return new SaleVo(
                sale.getId(),
                sale.getCheckInId(),
                sale.getQuantity(),
                sale.getUnitPrice(),
                sale.getTotalAmount(),
                sale.getSoldDate(),
                sale.getChannel(),
                sale.getNote(),
                sale.getCreatedAt()
        );
    }
}

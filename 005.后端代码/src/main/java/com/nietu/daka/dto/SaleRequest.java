package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 售出记录的新增入参。
 *
 * <p>数量上限由服务端按**未售出数量**校验（规范 领域规则 3 / PRD §6.3）：
 * 售出数量不能超过该条记录还没卖出的数量。这条约束必须在服务端兜住——
 * 只靠表单限制的话，改个客户端就能把库存做成负数。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SaleRequest(
        /** 关联的打卡记录 id */
        @NotBlank(message = "缺少关联的打卡记录")
        String checkInId,

        /** 售出数量 */
        @NotNull(message = "填一下卖出了几个")
        @Min(value = 1, message = "数量要大于 0")
        @Max(value = 999, message = "数量太大了")
        Integer quantity,

        /** 单价 */
        @NotNull(message = "填一个有效的单价")
        @DecimalMin(value = "0.00", message = "单价不能是负数")
        BigDecimal unitPrice,

        /** 售出日期 */
        @NotNull(message = "选一下售出日期")
        LocalDate soldDate,

        /** 销售渠道 */
        @Size(max = 20, message = "渠道名过长")
        String channel,

        /** 备注 */
        @Size(max = 100, message = "备注最多 100 字")
        String note
) {
}

package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.SaleRequest;
import com.nietu.daka.dto.SaleVo;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 售出记录。
 *
 * <p>**追加型，只增不改**（PRD §6.3）：金额已经进过报表，改写会让历史失真。
 * 数量上限由服务端按未售出数量校验。
 */
@Tag(name = "售出")
@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @Operation(summary = "列出售出记录（可按打卡记录过滤）")
    @GetMapping
    public Result<List<SaleVo>> list(@RequestParam(required = false) String checkInId) {
        return Result.ok(saleService.list(AuthContext.require(), checkInId));
    }

    @Operation(summary = "新增售出记录（数量不能超过未售出数量）")
    @PostMapping
    public Result<SaleVo> create(@RequestBody @Valid SaleRequest request) {
        return Result.ok(saleService.create(AuthContext.require(), request));
    }

    @Operation(summary = "撤掉一条售出记录（软删除）")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        saleService.delete(AuthContext.require(), id);
        return Result.ok();
    }
}

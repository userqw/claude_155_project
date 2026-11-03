package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.ReorderRequest;
import com.nietu.daka.dto.ShapeRequest;
import com.nietu.daka.dto.ShapeVo;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.ShapeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 品类（造型）管理。
 *
 * <p>对应 PRD §5.4.1。内置的四个品类可改名、可排序、**不可删**；
 * 自定义品类可增删改删。
 */
@Tag(name = "品类")
@RestController
@RequestMapping("/api/shapes")
public class ShapeController {

    private final ShapeService shapeService;

    public ShapeController(ShapeService shapeService) {
        this.shapeService = shapeService;
    }

    @Operation(summary = "列出全部品类（含内置），带每个品类的累计用量")
    @GetMapping
    public Result<List<ShapeVo>> list() {
        return Result.ok(shapeService.list(AuthContext.require()));
    }

    @Operation(summary = "新建自定义品类")
    @PostMapping
    public Result<ShapeVo> create(@RequestBody @Valid ShapeRequest request) {
        return Result.ok(shapeService.create(AuthContext.require(), request));
    }

    @Operation(summary = "修改品类（内置的可改名与换图标，不可改颜色）")
    @PutMapping("/{id}")
    public Result<ShapeVo> update(@PathVariable String id,
                                  @RequestBody @Valid ShapeRequest request) {
        return Result.ok(shapeService.update(AuthContext.require(), id, request));
    }

    @Operation(summary = "删除自定义品类（历史记录迁到「其他」）")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        shapeService.delete(AuthContext.require(), id);
        return Result.ok();
    }

    @Operation(summary = "调整品类顺序")
    @PostMapping("/reorder")
    public Result<Void> reorder(@RequestBody @Valid ReorderRequest request) {
        shapeService.reorder(AuthContext.require(), request.ids());
        return Result.ok();
    }
}

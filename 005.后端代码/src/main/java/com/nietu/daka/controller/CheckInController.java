package com.nietu.daka.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nietu.daka.common.Result;
import com.nietu.daka.dto.CheckInDto;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.CheckInService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 打卡记录。 */
@Tag(name = "打卡")
@RestController
@RequestMapping("/api/checkin")
public class CheckInController {

    private final CheckInService checkInService;

    public CheckInController(CheckInService checkInService) {
        this.checkInService = checkInService;
    }

    @Operation(summary = "分页查询打卡记录")
    @GetMapping
    public Result<Page<CheckIn>> list(@RequestParam(required = false) Integer year,
                                    @RequestParam(required = false) String shapeId,
                                    @RequestParam(defaultValue = "1") long page,
                                    @RequestParam(defaultValue = "20") long size) {
        return Result.ok(checkInService.list(AuthContext.require(), year, shapeId, page, size));
    }

    @Operation(summary = "新建打卡记录")
    @PostMapping
    public Result<CheckInDto> create(@RequestBody CheckInDto dto) {
        return Result.ok(checkInService.create(AuthContext.require(), dto));
    }

    @Operation(summary = "修改打卡记录")
    @PutMapping("/{id}")
    public Result<CheckInDto> update(@PathVariable String id, @RequestBody CheckInDto dto) {
        return Result.ok(checkInService.update(AuthContext.require(), id, dto));
    }

    @Operation(summary = "软删除打卡记录（进 30 天回收站）")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        checkInService.delete(AuthContext.require(), id);
        return Result.ok();
    }

    @Operation(summary = "从回收站恢复")
    @PostMapping("/{id}/restore")
    public Result<Void> restore(@PathVariable String id) {
        checkInService.restore(AuthContext.require(), id);
        return Result.ok();
    }
}

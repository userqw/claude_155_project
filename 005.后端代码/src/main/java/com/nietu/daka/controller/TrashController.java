package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.TrashVo;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.TrashService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 回收站。
 *
 * <p>软删除的记录保留 30 天（PRD §5.1.3），到期自动物理删除；
 * 用户也可以提前彻底删除。
 */
@Tag(name = "回收站")
@RestController
@RequestMapping("/api/trash")
public class TrashController {

    private final TrashService trashService;

    public TrashController(TrashService trashService) {
        this.trashService = trashService;
    }

    @Operation(summary = "回收站列表（打卡记录 + 素材）")
    @GetMapping
    public Result<List<TrashVo>> list() {
        return Result.ok(trashService.list(AuthContext.require()));
    }

    @Operation(summary = "彻底删除一条（不可恢复）")
    @DeleteMapping
    public Result<Void> purge(@RequestParam String entityType, @RequestParam String id) {
        trashService.purge(AuthContext.require(), entityType, id);
        return Result.ok();
    }

    @Operation(summary = "清空回收站")
    @DeleteMapping("/all")
    public Result<Void> purgeAll() {
        trashService.purgeAll(AuthContext.require());
        return Result.ok();
    }
}

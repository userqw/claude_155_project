package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.SyncPullResponse;
import com.nietu.daka.dto.SyncPushRequest;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 云端同步。
 *
 * <p>对应 PRD §5.6.2 的 /api/sync/push 与 /api/sync/pull。
 */
@Tag(name = "同步")
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @Operation(summary = "推送本地变更（字段级合并，后写覆盖先写）")
    @PostMapping("/push")
    public Result<Map<String, Object>> push(@RequestBody SyncPushRequest request) {
        return Result.ok(syncService.push(AuthContext.require(), request));
    }

    @Operation(summary = "拉取增量变更（since 之后 updated_at 有变动的）")
    @GetMapping("/pull")
    public Result<SyncPullResponse> pull(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since) {
        return Result.ok(syncService.pull(AuthContext.require(),
                since == null ? LocalDateTime.of(1970, 1, 1, 0, 0) : since));
    }
}

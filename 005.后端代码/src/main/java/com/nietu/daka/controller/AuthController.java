package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.LoginRequest;
import com.nietu.daka.dto.LoginResponse;
import com.nietu.daka.dto.ProfileRequest;
import com.nietu.daka.dto.ProfileResponse;
import com.nietu.daka.entity.Account;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 登录与账号。
 *
 * <p>对应 PRD §5.6.2 的接口契约。
 */
@Tag(name = "账号")
@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "微信一键登录（首次登录自动注册）")
    @PostMapping("/login")
    public Result<LoginResponse> login(@RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    @Operation(summary = "获取当前账号资料")
    @GetMapping("/profile")
    public Result<ProfileResponse> profile() {
        return Result.ok(new ProfileResponse(
                authService.profileView(AuthContext.require()),
                authService.isMockMode()));
    }

    @Operation(summary = "修改昵称头像")
    @PostMapping("/profile")
    public Result<ProfileResponse> updateProfile(@RequestBody ProfileRequest request) {
        String openid = AuthContext.require();
        authService.updateProfile(openid, request);
        return Result.ok(new ProfileResponse(authService.profileView(openid),
                authService.isMockMode()));
    }

    @Operation(summary = "注销账号并清除该账号全部数据")
    @PostMapping("/account/delete")
    public Result<Map<String, Boolean>> deleteAccount() {
        authService.deleteAccount(AuthContext.require());
        return Result.ok(Map.of("deleted", true));
    }

    @Operation(summary = "健康检查（不需要 token）")
    @GetMapping("/health")
    public Result<String> health() {
        return Result.ok("ok");
    }
}

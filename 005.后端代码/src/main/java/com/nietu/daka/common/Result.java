package com.nietu.daka.common;

/**
 * 统一响应体。前端 utils/auth.js 等按 {code, message, data} 约定解析。
 */
public record Result<T>(int code, String message, T data) {

    public static <T> Result<T> ok() {
        return new Result<>(ResultCode.SUCCESS.code(), ResultCode.SUCCESS.message(), null);
    }

    public static <T> Result<T> ok(T data) {
        return new Result<>(ResultCode.SUCCESS.code(), ResultCode.SUCCESS.message(), data);
    }

    public static <T> Result<T> fail(ResultCode rc) {
        return new Result<>(rc.code(), rc.message(), null);
    }

    public static <T> Result<T> fail(ResultCode rc, String message) {
        return new Result<>(rc.code(), message, null);
    }

    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, message, null);
    }
}

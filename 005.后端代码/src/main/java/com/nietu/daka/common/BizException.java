package com.nietu.daka.common;

/** 业务异常，由 GlobalExceptionHandler 统一转成 Result。 */
public class BizException extends RuntimeException {

    private final int code;

    public BizException(String message) {
        this(ResultCode.BAD_REQUEST.code(), message);
    }

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    public int getCode() {
        return code;
    }

    public static BizException unauthorized(String message) {
        return new BizException(ResultCode.UNAUTHORIZED.code(), message);
    }

    public static BizException notFound(String message) {
        return new BizException(ResultCode.NOT_FOUND.code(), message);
    }
}

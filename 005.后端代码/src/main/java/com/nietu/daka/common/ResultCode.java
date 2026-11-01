package com.nietu.daka.common;

/** 业务状态码。0 表示成功。 */
public enum ResultCode {

    /** 成功 */
    SUCCESS(0, "ok"),
    /** 参数不合法 */
    BAD_REQUEST(400, "请求参数有误"),
    /** 未登录或 token 失效 */
    UNAUTHORIZED(401, "未登录或登录已过期"),
    /** 无权访问 */
    FORBIDDEN(403, "没有权限"),
    /** 资源不存在 */
    NOT_FOUND(404, "资源不存在"),
    /** 服务器内部错误 */
    INTERNAL_ERROR(500, "服务器开小差了");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int code() {
        return code;
    }

    public String message() {
        return message;
    }
}

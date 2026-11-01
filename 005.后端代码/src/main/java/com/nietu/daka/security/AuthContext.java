package com.nietu.daka.security;

import com.nietu.daka.common.BizException;

/** 当前请求的登录用户。用 ThreadLocal 传递，请求结束由拦截器清理。 */
public final class AuthContext {

    private static final ThreadLocal<String> OPENID = new ThreadLocal<>();

    private AuthContext() {
    }

    public static void set(String openid) {
        OPENID.set(openid);
    }

    public static String get() {
        return OPENID.get();
    }

    /** 取当前 openid，没登录直接抛 401 */
    public static String require() {
        String openid = OPENID.get();
        if (openid == null || openid.isEmpty()) {
            throw BizException.unauthorized("未登录或登录已过期");
        }
        return openid;
    }

    public static void clear() {
        OPENID.remove();
    }
}

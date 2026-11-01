package com.nietu.daka.dto;


/**
 * 登录响应。
 */
public record LoginResponse(
    /** 自签 JWT，之后放 Authorization 头 */
    String token,
    /** 账号信息，PRD §5.6.2 的约定：account 是对象 */
    AccountView account,
    /** 是否本次首次注册 */
    boolean newUser,
    /** token 剩余有效期 */
    long expireSeconds,
    /**
     * 服务端是否在 mock 模式（没配小程序 appid/secret，openid 是 md5(code) 编出来的）。
     *
     * <p>客户端要把它显示给用户：mock 模式下的 openid **不是用户的真实微信号**，
     * 数据库里自然查不到「我的登录信息」。不说清楚，用户会以为登录坏了。
     */
    boolean mock
) {
}

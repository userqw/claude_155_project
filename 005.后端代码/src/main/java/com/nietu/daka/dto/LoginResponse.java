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
    long expireSeconds
) {
}

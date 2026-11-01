package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


/**
 * 登录请求：wx.login 拿到的 code，加上可选的昵称头像。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LoginRequest(
    /** wx.login 返回的临时 code，5 分钟有效 */
    String code,
    /** 昵称，选填 */
    String nickname,
    /** 头像地址，选填 */
    String avatarUrl
) {
}

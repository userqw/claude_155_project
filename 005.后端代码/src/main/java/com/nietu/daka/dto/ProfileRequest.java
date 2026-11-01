package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


/**
 * 修改资料。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProfileRequest(
    /** 昵称 */
    String nickname,
    /** 头像地址 */
    String avatarUrl
) {
}

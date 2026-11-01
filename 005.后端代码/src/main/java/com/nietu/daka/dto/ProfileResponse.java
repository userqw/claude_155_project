package com.nietu.daka.dto;

/**
 * Profile response: { account: { ... } }.
 *
 * @param account 账号信息
 * @param mock    服务端是否还在 mock 模式（没配 appid/secret，openid 是假的）。
 *                客户端靠它告诉用户「你还没连上真实微信号」——只看登录那次的
 *                结果不够，后端可能后来才配好 appid。
 */
public record ProfileResponse(AccountView account, boolean mock) {
}

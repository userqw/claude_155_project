package com.nietu.daka.dto;

/**
 * 微信 code 换来的会话信息。
 *
 * <p>对应 {@code jscode2session} 的返回：
 * <pre>
 * {
 *   "openid":     "用户在本小程序下的唯一标识",
 *   "session_key": "会话密钥（**不落库**，见 PRD §5.6.2）",
 *   "unionid":    "同一开放平台下的统一标识（仅在已绑定开放平台时返回）"
 * }
 * </pre>
 *
 * @param openid     用户标识，必有
 * @param unionid    开放平台统一标识，可能没有
 * @param sessionKey 会话密钥，只在内存里用一次，不存
 */
public record WechatSession(
        String openid,
        String unionid,
        String sessionKey
) {
}

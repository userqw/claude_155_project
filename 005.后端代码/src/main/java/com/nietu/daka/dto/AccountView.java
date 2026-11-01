package com.nietu.daka.dto;

import java.time.LocalDateTime;

/**
 * Account view returned to the client.
 *
 * <p>Shape follows PRD 5.6.2: login returns { token, account: { ... } }.
 */
public record AccountView(
        String openid,
        String unionid,
        String nickname,
        String avatarUrl,
        LocalDateTime createdAt
) {
}

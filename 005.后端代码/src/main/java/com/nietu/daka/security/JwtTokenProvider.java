package com.nietu.daka.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * 自签 JWT。
 *
 * <p>token 里只放 openid，不放任何业务数据；服务端每次请求都按 openid 过滤，
 * 拿着 token 也换不到别人的数据。
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtTokenProvider(JwtProperties properties) {
        this.properties = properties;
        byte[] secret = properties.getSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("app.jwt.secret 至少要 32 字节，当前 " + secret.length);
        }
        this.key = Keys.hmacShaKeyFor(secret);
    }

    /** 签发 token */
    public String createToken(String openid) {
        Date now = new Date();
        Date expire = new Date(now.getTime() + properties.getExpireHours() * 3600_000L);
        return Jwts.builder()
                .subject(openid)
                .issuedAt(now)
                .expiration(expire)
                .signWith(key)
                .compact();
    }

    /** 解析出 openid；token 无效或过期返回 null */
    public String parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("token 解析失败: {}", e.getMessage());
            return null;
        }
    }

    public long getExpireSeconds() {
        return properties.getExpireHours() * 3600L;
    }
}

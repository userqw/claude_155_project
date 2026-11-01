package com.nietu.daka.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.WechatSession;
import com.nietu.daka.security.JwtProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

/**
 * code 换 openid。
 *
 * <p>本地没配 appid/secret 时走 mock：用 code 的 md5 当 openid，
 * 保证流程能跑通（仅开发环境）。真实模式下调微信的 jscode2session。
 */
@Component
public class WechatAuthService {

    private static final Logger log = LoggerFactory.getLogger(WechatAuthService.class);

    private final JwtProperties jwtProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** 本地联调用的假 code2session；生产环境必须是 false */
    private final boolean mockEnabled;

    public WechatAuthService(JwtProperties jwtProperties, ObjectMapper objectMapper,
                             @org.springframework.beans.factory.annotation.Value("${app.wechat.mock:false}")
                             boolean mockEnabled) {
        this.jwtProperties = jwtProperties;
        this.objectMapper = objectMapper;
        this.mockEnabled = mockEnabled;
    }

    /** 现在是不是在跑 mock：没配 appid/secret 时为 true */
    public boolean isMockMode() {
        return jwtProperties.getWechatAppId().isBlank() || jwtProperties.getWechatSecret().isBlank();
    }

    /**
     * code 换会话信息。
     *
     * @throws BizException 换取失败（code 无效 / 已用过 / 频率限制等），消息里带上原因
     */
    public WechatSession exchange(String code) {
        String appId = jwtProperties.getWechatAppId();
        String secret = jwtProperties.getWechatSecret();
        if (appId.isBlank() || secret.isBlank()) {
            if (!mockEnabled) {
                throw new BizException("服务端未配置小程序 appid/secret");
            }
            log.warn("未配置小程序 appid/secret，使用 mock 模式解析 code（仅限本地联调）");
            return new WechatSession("mock_" + md5(code).substring(0, 24), null, null);
        }
        return exchangeReal(code, appId, secret);
    }

    private WechatSession exchangeReal(String code, String appId, String secret) {
        String url = "https://api.weixin.qq.com/sns/jscode2session"
                + "?appid=" + appId
                + "&secret=" + secret
                + "&js_code=" + code
                + "&grant_type=authorization_code";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();
        String body;
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            body = response.body();
        } catch (Exception e) {
            throw new BizException("调用微信登录接口失败: " + e.getMessage());
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(body);
        } catch (Exception e) {
            throw new BizException("微信登录接口返回了看不懂的内容");
        }

        if (node.hasNonNull("openid")) {
            String unionid = node.hasNonNull("unionid") ? node.get("unionid").asText() : null;
            // session_key 拿到也不用：PRD §5.6.2 明确「服务端不存 session_key」
            return new WechatSession(node.get("openid").asText(), unionid, null);
        }
        throw new BizException("微信登录失败: " + describe(node));
    }

    /** 把微信的 errcode 翻译成人话 */
    private String describe(JsonNode node) {
        int errcode = node.has("errcode") ? node.get("errcode").asInt() : 0;
        String errmsg = node.has("errmsg") ? node.get("errmsg").asText() : "未知错误";
        return switch (errcode) {
            case 40029 -> "code 无效（小程序 appid 与后端配置不一致，或 code 已被用掉）";
            case 40163 -> "code 已被使用，请重新登录";
            case 40013 -> "小程序 appid 不正确";
            case 40125 -> "小程序 secret 不正确";
            case 45011 -> "调用微信接口太频繁，请稍后再试";
            case -1 -> "微信服务繁忙，请稍后再试";
            default -> errmsg + "（errcode " + errcode + "）";
        };
    }

    private String md5(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(text.hashCode());
        }
    }
}

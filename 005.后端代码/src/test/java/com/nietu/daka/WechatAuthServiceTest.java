package com.nietu.daka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.config.WechatProperties;
import com.nietu.daka.dto.WechatSession;
import com.nietu.daka.service.WechatAuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * code 换 openid 的本地行为。
 *
 * <p>不联网，只验证三件事：mock 模式给出的 openid 是稳定的；
 * 缺凭据时本地自动降级、生产则明确报错；强制 mock 开关有效。
 */
class WechatAuthServiceTest {

    private WechatProperties props(String appId, String secret, boolean mock, boolean requireCredentials) {
        WechatProperties p = new WechatProperties();
        p.setAppId(appId);
        p.setSecret(secret);
        p.setMock(mock);
        p.setRequireCredentials(requireCredentials);
        // 指向一个不存在的文件，避免测试时读到真实的 project.config.json
        p.setAppIdFile("target/no-such-project.config.json");
        return p;
    }

    @Test
    @DisplayName("本地缺凭据时自动降级为 mock：openid 以 mock_ 开头且稳定")
    void mockOpenidIsStable() {
        WechatAuthService svc = new WechatAuthService(
                props("", "", false, false), new ObjectMapper());
        assertThat(svc.isMockMode()).isTrue();

        WechatSession a = svc.exchange("code_abc");
        WechatSession b = svc.exchange("code_abc");
        assertThat(a.openid()).startsWith("mock_");
        assertThat(a.openid()).isEqualTo(b.openid());
        assertThat(a.openid()).isNotEqualTo(svc.exchange("code_xyz").openid());
    }

    @Test
    @DisplayName("生产模式缺凭据时直接报错，不悄悄用假 openid 建号")
    void missingCredentialsFailsLoudly() {
        WechatAuthService svc = new WechatAuthService(
                props("", "", false, true), new ObjectMapper());
        assertThatThrownBy(() -> svc.exchange("code_abc"))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("appid");
    }

    @Test
    @DisplayName("强制 mock 的逃生门：填了凭据也照样用假 openid")
    void forcedMockIgnoresCredentials() {
        WechatAuthService svc = new WechatAuthService(
                props("wx_real_appid", "real_secret", true, false), new ObjectMapper());
        WechatSession session = svc.exchange("code_abc");
        assertThat(session.openid()).startsWith("mock_");
    }

    @Test
    @DisplayName("游客 AppID 不算数：换不到 openid，等同于没配")
    void touristAppIdIsNotAnAppId() {
        WechatAuthService svc = new WechatAuthService(
                props(WechatProperties.TOURIST_APP_ID, "secret", false, false), new ObjectMapper());
        assertThat(svc.appId()).isEmpty();
        assertThat(svc.isMockMode()).isTrue();
    }
}

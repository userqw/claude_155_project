package com.nietu.daka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.WechatSession;
import com.nietu.daka.security.JwtProperties;
import com.nietu.daka.service.WechatAuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * code 换 openid 的本地行为。
 *
 * <p>不联网，只验证两件事：mock 模式给出的 openid 是稳定的，
 * 以及没配 appid/secret 又关了 mock 时，错误要说人话。
 */
class WechatAuthServiceTest {

    private WechatAuthService service(boolean mockEnabled) {
        JwtProperties props = new JwtProperties();
        props.setWechatAppId("");
        props.setWechatSecret("");
        return new WechatAuthService(props, new ObjectMapper(), mockEnabled);
    }

    @Test
    @DisplayName("mock 模式：openid 以 mock_ 开头，同一个 code 结果稳定")
    void mockOpenidIsStable() {
        WechatAuthService svc = service(true);
        assertThat(svc.isMockMode()).isTrue();

        WechatSession a = svc.exchange("code_abc");
        WechatSession b = svc.exchange("code_abc");
        assertThat(a.openid()).startsWith("mock_");
        assertThat(a.openid()).isEqualTo(b.openid());
        assertThat(a.openid()).isNotEqualTo(svc.exchange("code_xyz").openid());
    }

    @Test
    @DisplayName("没配 appid/secret 又关了 mock：直接报错，不静默降级")
    void missingCredentialsFailsLoudly() {
        WechatAuthService svc = service(false);
        assertThatThrownBy(() -> svc.exchange("code_abc"))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("appid");
    }
}

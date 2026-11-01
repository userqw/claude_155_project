package com.nietu.daka;

import com.nietu.daka.dto.LoginRequest;
import com.nietu.daka.dto.LoginResponse;
import com.nietu.daka.dto.WechatSession;
import com.nietu.daka.entity.Account;
import com.nietu.daka.mapper.AccountMapper;
import com.nietu.daka.service.AuthService;
import com.nietu.daka.service.WechatAuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * 真实微信登录的落库行为。
 *
 * <p>把 code 换 openid 那一步打桩，专注验证「拿到真实 openid 之后会怎样」：
 * 建号、存 unionid、存昵称头像、mock 标记为 false。
 */
@SpringBootTest
@ActiveProfiles({"dev", "local"})
class RealWechatLoginTest {

    @MockitoBean
    private WechatAuthService wechatAuthService;

    @Autowired
    private AuthService authService;
    @Autowired
    private AccountMapper accountMapper;

    @Test
    @DisplayName("真实 openid：建号、存 unionid、存昵称头像，且不再标记为 mock")
    void realOpenidIsPersisted() {
        when(wechatAuthService.exchange("real_code_1"))
                .thenReturn(new WechatSession("oREAL_openid_1", "uUNION_1", null));
        when(wechatAuthService.isMockMode()).thenReturn(false);

        LoginResponse res = authService.login(
                new LoginRequest("real_code_1", "小陶", "https://x/a.png"));

        assertThat(res.mock()).isFalse();
        assertThat(res.account().openid()).isEqualTo("oREAL_openid_1");
        assertThat(res.account().unionid()).isEqualTo("uUNION_1");
        assertThat(res.account().nickname()).isEqualTo("小陶");

        Account row = accountMapper.selectById("oREAL_openid_1");
        assertThat(row).isNotNull();
        assertThat(row.getUnionid()).isEqualTo("uUNION_1");
        assertThat(row.getNickname()).isEqualTo("小陶");
        assertThat(row.getAvatarUrl()).isEqualTo("https://x/a.png");

        authService.deleteAccount("oREAL_openid_1");
    }

    @Test
    @DisplayName("第二次登录：unionid 后来才给出来时会被补上")
    void unionidIsBackfilledOnLaterLogin() {
        when(wechatAuthService.exchange("real_code_2"))
                .thenReturn(new WechatSession("oREAL_openid_2", null, null));
        when(wechatAuthService.isMockMode()).thenReturn(false);
        authService.login(new LoginRequest("real_code_2", null, null));

        // 第二次微信才返回 unionid（用户后来才绑了开放平台）
        when(wechatAuthService.exchange("real_code_2"))
                .thenReturn(new WechatSession("oREAL_openid_2", "uUNION_2", null));
        LoginResponse res = authService.login(new LoginRequest("real_code_2", null, null));

        assertThat(res.account().unionid()).isEqualTo("uUNION_2");
        assertThat(accountMapper.selectById("oREAL_openid_2").getUnionid()).isEqualTo("uUNION_2");

        authService.deleteAccount("oREAL_openid_2");
    }

    @Test
    @DisplayName("mock 模式下账号也是照常建的，只是 openid 是编出来的")
    void mockModeStillCreatesAccount() {
        when(wechatAuthService.exchange("mock_code_3"))
                .thenReturn(new WechatSession("mock_abc123", null, null));
        when(wechatAuthService.isMockMode()).thenReturn(true);

        LoginResponse res = authService.login(new LoginRequest("mock_code_3", "测试", null));
        assertThat(res.mock()).isTrue();
        assertThat(res.newUser()).isTrue();
        assertThat(accountMapper.selectById("mock_abc123")).isNotNull();

        authService.deleteAccount("mock_abc123");
    }
}

package com.nietu.daka.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 微信小程序凭据。
 *
 * <p>两个值都来自微信公众平台 → 开发管理 → 开发设置：
 * <ul>
 *   <li><b>AppID</b> —— 小程序自己的身份标识</li>
 *   <li><b>AppSecret</b> —— 换 openid 用的密钥，等同于密码，不要提交进仓库</li>
 * </ul>
 *
 * <p>AppID 可以让后端直接从小程序工程里读（{@code app-id-file}），
 * 这样后端和小程序永远用同一个 AppID——两边不一致正是微信返回
 * <code>40029 invalid code</code> 的头号原因。
 */
@Component
@ConfigurationProperties(prefix = "app.wechat")
public class WechatProperties {

    /** 小程序 AppID。留空则尝试从 app-id-file 读 */
    private String appId = "";

    /** 小程序 AppSecret。**不要提交进仓库** */
    private String secret = "";

    /**
     * 强制使用假 code2session。
     *
     * <p>没配 appid/secret 时会**自动降级**为 mock（本地开发友好）；
     * 这个开关是反向的逃生门：填了凭据也照样用假 openid。
     * 想让「缺凭据」直接报错，看 {@link #requireCredentials}。
     */
    private boolean mock = false;

    /**
     * 没配 appid/secret 时是否直接报错。
     *
     * <p>生产必须为 true——否则线上会在用户毫不知情的情况下用假 openid 建号，
     * 数据全都对不上。本地开发为 false：没配凭据就自动降级为 mock，
     * 不用每次都配一遍。
     */
    private boolean requireCredentials = false;

    /**
     * 从哪个文件读 AppID。相对工作目录的路径，
     * 默认 {@code ../001/project.config.json}（小程序工程目录）。
     */
    private String appIdFile = "../001/project.config.json";

    /** 游客 AppID：不是真身份，换不到 openid */
    public static final String TOURIST_APP_ID = "touristappid";

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public boolean isMock() {
        return mock;
    }

    public void setMock(boolean mock) {
        this.mock = mock;
    }

    public boolean isRequireCredentials() {
        return requireCredentials;
    }

    public void setRequireCredentials(boolean requireCredentials) {
        this.requireCredentials = requireCredentials;
    }

    public String getAppIdFile() {
        return appIdFile;
    }

    public void setAppIdFile(String appIdFile) {
        this.appIdFile = appIdFile;
    }
}

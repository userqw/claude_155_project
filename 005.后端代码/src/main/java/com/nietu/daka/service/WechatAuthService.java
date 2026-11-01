package com.nietu.daka.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.config.WechatProperties;
import com.nietu.daka.dto.WechatSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

    private final WechatProperties props;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** 解析出来的 AppID（显式配置优先，其次从小程序工程读）；null 表示还没解析过 */
    private volatile String resolvedAppId;
    private volatile boolean resolved = false;

    public WechatAuthService(WechatProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
    }

    /**
     * 启动时把微信登录的状态讲清楚。
     *
     * <p>这件事特别容易卡住人：配置没填对时，登录会「成功」但拿到的
     * 是假 openid，数据库里查不到自己的账号，日志里也只有一行 WARN。
     * 启动时说清楚要改哪两个文件，比让人自己猜强得多。
     */
    @jakarta.annotation.PostConstruct
    public void reportSetup() {
        String appId = appId();
        String secret = secret();
        boolean appIdMissing = appId.isBlank();
        boolean secretMissing = secret.isBlank();

        if (!appIdMissing && !secretMissing) {
            log.info("微信登录：AppID {} 与 AppSecret 都已配置，将使用真实的 jscode2session", appId);
            return;
        }

        String appIdLine = appIdMissing
                ? "  AppID    ：还没读到。填 001/project.config.json 的 appid（真实 AppID，"
                        + "游客 AppID 换不到 openid）"
                : "  AppID    ：已从小程序工程读到 " + appId;
        String secretLine = secretMissing
                ? "  AppSecret：还没填。填 005.后端代码/src/main/resources/application-local.yml 的"
                        + " app.wechat.secret（微信公众平台 → 开发管理 → 开发设置）"
                : "  AppSecret：已配置";

        log.warn("""

                ============================================================
                  微信登录：未配置完成，当前使用【本地 mock 模式】
                  登录能跑通，但拿到的是 md5(code) 编出来的假 openid，
                  不是用户的真实微信号，数据库里查不到自己的账号。

                {}
                {}

                  AppID 后端会自己从 001/project.config.json 读，
                  所以两边一定是同一个，不会出现 appid 不一致。
                ============================================================
                """, appIdLine, secretLine);
    }

    /** 真正生效的 AppID：显式配置的优先，其次从小程序工程读 */
    public String appId() {
        if (!resolved) {
            synchronized (this) {
                if (!resolved) {
                    resolvedAppId = resolveAppId();
                    resolved = true;
                    if (resolvedAppId == null || resolvedAppId.isBlank()) {
                        log.info("未配置小程序 AppID，将使用本地 mock 模式登录");
                    } else {
                        log.info("小程序 AppID: {}", resolvedAppId);
                    }
                }
            }
        }
        return resolvedAppId == null ? "" : resolvedAppId;
    }

    /**
     * 现在是不是在跑 mock：没配 appid/secret 时为 true。
     * 游客 AppID（touristappid）也算没配——它换不到 openid。
     */
    public boolean isMockMode() {
        return appId().isBlank() || secret().isBlank();
    }

    /**
     * code 换会话信息。
     *
     * @throws BizException 换取失败（code 无效 / 已用过 / 频率限制等），消息里带上原因
     */
    public WechatSession exchange(String code) {
        String appId = appId();
        String secret = secret();
        boolean missing = appId.isBlank() || secret.isBlank();

        if (missing) {
            // 生产环境（require-credentials）不容许悄悄用假 openid 建号
            if (props.isRequireCredentials()) {
                throw new BizException("服务端未配置小程序 appid/secret，无法完成真实微信登录");
            }
            log.warn("未配置小程序 appid/secret，使用 mock 模式解析 code（仅限本地联调）");
            return new WechatSession("mock_" + md5(code).substring(0, 24), null, null);
        }
        if (props.isMock()) {
            // 逃生门：明明配了凭据也强制走 mock
            log.warn("app.wechat.mock=true，忽略已配置的 appid/secret，强制使用 mock 模式");
            return new WechatSession("mock_" + md5(code).substring(0, 24), null, null);
        }
        return exchangeReal(code, appId, secret);
    }

    /**
     * 真正生效的 AppSecret。
     *
     * <p>模板里的占位文字（比如「这里填你的 AppSecret」）含中文，
     * 直接拼进 URL 会抛 URISyntaxException——报的还是一个看不懂的错。
     * 这里把它当成「没填」，好过让用户对着 URI 语法错误发懵。
     */
    private String secret() {
        String raw = props.getSecret() == null ? "" : props.getSecret().trim();
        if (raw.isEmpty()) {
            return "";
        }
        if (!raw.matches("[\\x20-\\x7E]+")) {
            log.warn("AppSecret 含有非 ASCII 字符，多半是没替换的模板占位文字，视为未配置");
            return "";
        }
        String lower = raw.toLowerCase();
        if (lower.contains("your_") || lower.contains("todo") || lower.contains("xxxx")
                || lower.contains("填你的") || lower.contains("你的appsecret")) {
            log.warn("AppSecret 看起来还是模板占位文字，视为未配置");
            return "";
        }
        return raw;
    }

    /**
     * 解析 AppID：显式配置优先，否则从小程序工程的 project.config.json 里读。
     *
     * <p>从工程里读是为了让后端和小程序用同一个 AppID。
     */
    private String resolveAppId() {
        String explicit = props.getAppId() == null ? "" : props.getAppId().trim();
        if (!explicit.isEmpty()) {
            return isTourist(explicit) ? "" : explicit;
        }
        String fromFile = readAppIdFromProject();
        return fromFile == null ? "" : fromFile;
    }

    /** 从 project.config.json 里读 appid */
    private String readAppIdFromProject() {
        String configured = props.getAppIdFile();
        if (configured == null || configured.isBlank()) {
            return null;
        }
        // 配置的路径优先；再试几个常见的相对位置（从 005 目录跑、从仓库根目录跑）
        String[] candidates = {
                configured,
                "001/project.config.json",
                "../001/project.config.json"
        };
        for (String candidate : candidates) {
            try {
                Path path = Paths.get(candidate);
                if (!Files.isRegularFile(path)) {
                    continue;
                }
                String content = Files.readString(path, StandardCharsets.UTF_8);
                JsonNode node = objectMapper.readTree(content);
                JsonNode appid = node.get("appid");
                if (appid == null || appid.isNull()) {
                    continue;
                }
                String value = appid.asText("").trim();
                if (value.isEmpty() || isTourist(value)) {
                    log.warn("{} 里的 appid 是 {}，不是真实 AppID，换不到 openid",
                            path, value.isEmpty() ? "空" : value);
                    return null;
                }
                log.info("从 {} 读到小程序 AppID: {}", path, value);
                return value;
            } catch (Exception e) {
                // 读不到就试下一个候选路径
                log.debug("读取 {} 失败: {}", candidate, e.getMessage());
            }
        }
        return null;
    }

    /** 游客 AppID 不是真身份 */
    private boolean isTourist(String appId) {
        return appId.isBlank() || WechatProperties.TOURIST_APP_ID.equals(appId);
    }

    private WechatSession exchangeReal(String code, String appId, String secret) {
        // 参数要转义：AppSecret 一般是字母数字，但 code 可能带特殊字符
        String url = "https://api.weixin.qq.com/sns/jscode2session"
                + "?appid=" + enc(appId)
                + "&secret=" + enc(secret)
                + "&js_code=" + enc(code)
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

    /** URL 参数转义 */
    private String enc(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String md5(String text) {        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(text.hashCode());
        }
    }
}

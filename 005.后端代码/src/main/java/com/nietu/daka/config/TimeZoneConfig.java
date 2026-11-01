package com.nietu.daka.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;

import java.util.TimeZone;

/**
 * 把 JVM 默认时区固定成 UTC。
 *
 * <p><b>为什么不能只写在 main() 里</b>：{@code @SpringBootTest} 不会执行 main()，
 * 于是测试跑的是本机时区、线上跑的是 UTC——同一个 {@code LocalDateTime.now()}
 * 在两处差 8 小时，测试里写进去的 {@code updated_at} 和线上格式对不上，
 * 「后写覆盖先写」的同步判定也跟着漂。
 *
 * <p>数据一律按 UTC 存：客户端上传的是 ISO-8601（UTC），服务端也按 UTC 比，
 * 两边才不会因为时差把「旧版本」判成「新版本」。
 */
@Configuration
public class TimeZoneConfig {

    @PostConstruct
    public void useUtcAsDefault() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}

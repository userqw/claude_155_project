package com.nietu.daka.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * JSON 序列化：时间一律带 UTC 时区标记。
 *
 * <p><b>为什么必须带 Z</b>：{@code LocalDateTime} 默认序列化出来是
 * {@code "2026-03-10T10:15:30"}，没有时区信息。JavaScript 的
 * {@code new Date("2026-03-10T10:15:30")} 会把它当成**本地时间**解析——
 * 东八区整整差 8 小时，跨端算出来的日期全错。
 *
 * <p>本项目所有 {@code LocalDateTime} 存的都是 UTC（规范 DB-03），
 * 所以序列化时补上 {@code Z}，语义才准确。
 *
 * <p><b>反序列化必须对称</b>：客户端（含小程序）上传的时间戳就是带 Z 的
 * ISO-8601 字符串，解析器也要认它。两边不一致就是「同步时日期莫名偏移」。
 */
@Configuration
public class JacksonConfig {

    /** 带 Z 的 ISO-8601，毫秒精度 */
    private static final DateTimeFormatter ISO_UTC =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer utcDateTimeCustomizer() {
        return builder -> {
            SimpleModule module = new SimpleModule();

            // 出参：补上 Z
            module.addSerializer(LocalDateTime.class, new JsonSerializer<LocalDateTime>() {
                @Override
                public void serialize(LocalDateTime value, JsonGenerator gen,
                                      SerializerProvider provider) throws IOException {
                    gen.writeString(ISO_UTC.format(value));
                }
            });

            // 入参：认带 Z 的，也认不带 Z 的
            module.addDeserializer(LocalDateTime.class, new com.fasterxml.jackson.databind.JsonDeserializer<LocalDateTime>() {
                @Override
                public LocalDateTime deserialize(com.fasterxml.jackson.core.JsonParser p,
                                                 com.fasterxml.jackson.databind.DeserializationContext ctx)
                        throws IOException {
                    String text = p.getValueAsString();
                    if (text == null || text.isBlank()) {
                        return null;
                    }
                    String trimmed = text.trim();
                    // 去掉尾部 Z 再按本地日期时间解析——值本身已经是 UTC 了
                    if (trimmed.endsWith("Z") || trimmed.endsWith("z")) {
                        trimmed = trimmed.substring(0, trimmed.length() - 1);
                    }
                    return LocalDateTime.parse(trimmed, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                }
            });

            builder.modulesToInstall(module);
        };
    }
}

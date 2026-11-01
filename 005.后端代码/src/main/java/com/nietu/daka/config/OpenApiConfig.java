package com.nietu.daka.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 接口文档：Swagger UI 在 /swagger-ui.html。 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI nieTuDaKaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("捏土打卡 · 小程序服务端 API")
                        .description("对应 PRD V1.2 §5.6.2 的接口契约；"
                                + "登录 wx.login 拿 code 换 token，数据同步见 /api/sync。")
                        .version("1.0.0")
                        .contact(new Contact().name("捏土打卡")));
    }
}

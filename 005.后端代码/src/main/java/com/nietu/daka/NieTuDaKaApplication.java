package com.nietu.daka;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

/**
 * 捏土打卡 · 小程序服务端。
 *
 * <p>技术栈：Spring Boot 3.5 / JDK 21 / MyBatis-Plus / MySQL 8 / 自签 JWT / SpringDoc。
 * <p>数据库表与视图见 004数据库脚本/。
 *
 * <p><b>时区</b>：统一用 UTC。客户端上传的时间戳是 ISO-8601（UTC），
 * 服务端也按 UTC 存和比，两边才不会因为时差把「旧版本」判成「新版本」。
 */
@SpringBootApplication
@EnableScheduling
@MapperScan("com.nietu.daka.mapper")
public class NieTuDaKaApplication {

    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(NieTuDaKaApplication.class, args);
    }
}

package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 标签的新增/修改入参。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TagRequest(
        /** 标签名 */
        @NotBlank(message = "给这个标签起个名字")
        @Size(max = 20, message = "名称最多 20 个字")
        String name,

        /** 颜色，形如 #RRGGBB */
        @Size(max = 9, message = "颜色格式应为 #RRGGBB")
        String color
) {
}

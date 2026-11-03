package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 品类（造型）的新增/修改入参。
 *
 * <p>与 {@code ShapeDto}（同步协议用）分开：这个是**面向接口调用方**的，
 * 有完整的校验与语义说明；同步协议要兼容各种历史客户端，校验反而要松。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ShapeRequest(
        /** 名称。内置品类可改名，自定义品类新建时必填 */
        @NotBlank(message = "给这个品类起个名字")
        @Size(max = 20, message = "名称最多 20 个字")
        String name,

        /** 图标（emoji）。内置品类默认是 svg，选了这个就改用 emoji */
        @Size(max = 8, message = "图标最多 8 个字符")
        String icon,

        /** svg 图标路径。留空表示用 emoji */
        @Size(max = 200, message = "图标路径过长")
        String iconPath,

        /** 主题色，形如 #RRGGBB */
        @Size(max = 9, message = "颜色格式应为 #RRGGBB")
        String color,

        /** 默认单价，选填 */
        java.math.BigDecimal defaultPrice
) {
}

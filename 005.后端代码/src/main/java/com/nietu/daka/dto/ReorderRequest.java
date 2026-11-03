package com.nietu.daka.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 排序入参：按数组顺序重排。
 *
 * @param ids 有序的 id 列表
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ReorderRequest(
        @NotEmpty(message = "排序列表不能为空")
        List<String> ids
) {
}

package com.nietu.daka.common;

import java.util.List;

/**
 * 分页结果。
 *
 * <p>不用 MyBatis-Plus 的 {@code Page<T>} 直接出参：那是持久层的对象，
 * 直接序列化等于把 ORM 的内部结构暴露成接口契约（规范 API-02）。
 * 这个 record 是**接口的形状**，与底层用什么分页实现解耦。
 *
 * @param records 当前页数据
 * @param total   总条数
 * @param page    当前页码，从 1 开始
 * @param size    每页条数
 * @param pages   总页数
 */
public record PageResult<T>(
        List<T> records,
        long total,
        long page,
        long size,
        long pages
) {

    public static <T> PageResult<T> of(List<T> records, long total, long page, long size) {
        long safeSize = size <= 0 ? 1 : size;
        long pages = (total + safeSize - 1) / safeSize;
        return new PageResult<>(records == null ? List.of() : records, total, page, safeSize, pages);
    }
}

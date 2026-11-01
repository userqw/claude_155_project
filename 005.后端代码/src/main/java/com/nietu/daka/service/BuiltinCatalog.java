package com.nietu.daka.service;

import java.util.List;

/**
 * 内置造型与标签的定义。
 *
 * <p>与 001/utils/constants.js 的 BUILTIN_SHAPES / BUILTIN_TAGS 保持一致——
 * 新用户建号时按这份定义给每个账号复制一份，之后用户可以自由改名改色。
 */
public final class BuiltinCatalog {

    public record ShapeSeed(String id, String name, String icon, String iconPath,
                            String color, int slot, int sort) {
    }

    public record TagSeed(String id, String name, String color) {
    }

    /** 分类色取自 dataviz 校验过的马卡龙色板（亮色模式） */
    public static final List<ShapeSeed> SHAPES = List.of(
            new ShapeSeed("shape_ob11", "OB11娃头", "🧸", "/assets/icons/ob11.svg", "#F68CA1", 0, 0),
            new ShapeSeed("shape_qq", "QQ人", "🙂", "/assets/icons/qq.svg", "#55BCFA", 1, 1),
            new ShapeSeed("shape_zhengbi", "正比", "🧍", null, "#54CB99", 2, 2),
            new ShapeSeed("shape_other", "其他", "✨", null, "#C49BF3", 3, 3)
    );

    public static final List<TagSeed> TAGS = List.of(
            new TagSeed("tag_limit", "限定配色", "#EB6834"),
            new TagSeed("tag_practice", "练手", "#2A78D6"),
            new TagSeed("tag_gift", "送人", "#1BAF7A"),
            new TagSeed("tag_rework", "返工", "#EDA100"),
            new TagSeed("tag_urgent", "急单", "#E87BA4"),
            new TagSeed("tag_dropped", "已淘汰", "#898781")
    );

    private BuiltinCatalog() {
    }
}

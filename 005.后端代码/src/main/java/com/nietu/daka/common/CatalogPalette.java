package com.nietu.daka.common;

/**
 * 品类色板。
 *
 * <p>**必须与前端 {@code 001/utils/constants.js} 的 {@code SHAPE_COLORS} 逐值一致**——
 * 前端按 {@code slot} 取色（{@code shapeColor()}），后端按同一套规则写库，
 * 两边才能对上。改这里就要同步改那边。
 *
 * <p>槽位 0~3 是内置品类专用，4~7 是自定义品类的扩展槽
 * （设计规范：分类颜色按实体固定，**固定顺序、不循环**——
 * 复用色槽会让某个品类的颜色随别人增删而变）。
 */
public final class CatalogPalette {

    /** 亮色模式色板 */
    public static final String[] LIGHT = {
            "#F68CA1", "#55BCFA", "#54CB99", "#C49BF3",
            "#F7B267", "#E88AC0", "#7FD1A8", "#8FB8F0"
    };

    /** 暗色模式色板 */
    public static final String[] DARK = {
            "#D46D83", "#2F9CD8", "#2BAA7B", "#A57CD2",
            "#D99A52", "#D470A2", "#5EB88A", "#7099E0"
    };

    /** 自定义品类可用的扩展槽（4~7），固定顺序不循环 */
    public static final int[] EXTENSION_SLOTS = {4, 5, 6, 7};

    private CatalogPalette() {
    }

    /** 按色槽取色。越界时环绕，与前端的 {@code slot % length} 行为一致 */
    public static String colorOf(int slot, boolean dark) {
        String[] palette = dark ? DARK : LIGHT;
        int idx = Math.floorMod(slot, palette.length);
        return palette[idx];
    }
}

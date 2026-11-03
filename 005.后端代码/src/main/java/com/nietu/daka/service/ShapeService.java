package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.common.CatalogPalette;
import com.nietu.daka.dto.ShapeRequest;
import com.nietu.daka.dto.ShapeVo;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Shape;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.ShapeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 品类（造型）管理。
 *
 * <p>规则（PRD §5.4.1）：
 * <ul>
 *   <li>内置品类（OB11娃头 / QQ人 / 正比 / 其他）**可改名、可换图标、可排序，不可删除**</li>
 *   <li>自定义品类可增删改删，删除时历史记录迁到「其他」</li>
 *   <li>自定义品类最多 4 个，色槽固定用 4~7，**不循环**</li>
 * </ul>
 *
 * <p>所有查询都带 openid：复合主键 (openid, id) 下这是租户隔离的最后一道防线
 * （规范 DB-04）。
 */
@Service
public class ShapeService {

    private final ShapeMapper shapeMapper;
    private final CheckInMapper checkInMapper;

    public ShapeService(ShapeMapper shapeMapper, CheckInMapper checkInMapper) {
        this.shapeMapper = shapeMapper;
        this.checkInMapper = checkInMapper;
    }

    /** 列出全部品类（含内置），按 sort 排序 */
    public List<ShapeVo> list(String openid) {
        List<Shape> shapes = shapeMapper.selectList(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .isNull(Shape::getDeletedAt)
                .orderByAsc(Shape::getSort)
                .orderByAsc(Shape::getId));
        Map<String, Integer> used = usedCounts(openid);
        return shapes.stream()
                .map(s -> ShapeVo.of(s, used.getOrDefault(s.getId(), 0)))
                .toList();
    }

    /**
     * 新建自定义品类。
     *
     * <p>色槽从扩展槽 4~7 里取第一个空的，**用完就拒绝**，不复用——
     * 复用会让某个品类的颜色随别人增删而变（设计规范）。
     */
    @Transactional
    public ShapeVo create(String openid, ShapeRequest request) {
        List<Shape> existing = shapeMapper.selectList(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .isNull(Shape::getDeletedAt));
        int slot = freeExtensionSlot(existing);

        LocalDateTime now = LocalDateTime.now();
        Shape shape = new Shape();
        shape.setOpenid(openid);
        shape.setId("shape_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        shape.setName(request.name().trim());
        shape.setIcon(request.icon() == null || request.icon().isBlank() ? "🎨" : request.icon());
        shape.setIconPath(request.iconPath() == null ? "" : request.iconPath());
        shape.setColor(request.color() == null || request.color().isBlank()
                ? CatalogPalette.colorOf(slot, false)
                : request.color());
        shape.setSlot(slot);
        shape.setDefaultPrice(request.defaultPrice());
        shape.setIsBuiltin(0);
        shape.setSort(nextSort(existing));
        shape.setCreatedAt(now);
        shape.setUpdatedAt(now);
        shapeMapper.insert(shape);
        return ShapeVo.of(shape, 0);
    }

    /**
     * 修改品类。
     *
     * <p>内置品类只允许改名称与图标——**颜色与色槽是固定的**
     * （颜色跟着分类实体走，筛选后不能换色）。
     */
    @Transactional
    public ShapeVo update(String openid, String id, ShapeRequest request) {
        Shape shape = require(openid, id);
        boolean builtin = shape.getIsBuiltin() != null && shape.getIsBuiltin() == 1;

        shape.setName(request.name().trim());
        if (request.icon() != null && !request.icon().isBlank()) {
            shape.setIcon(request.icon());
            // 用户自己挑了图标，他选的就优先于内置默认的 svg
            shape.setIconPath(request.iconPath() == null ? "" : request.iconPath());
        } else if (request.iconPath() != null) {
            shape.setIconPath(request.iconPath());
        }
        if (!builtin) {
            if (request.color() != null && !request.color().isBlank()) {
                shape.setColor(request.color());
            }
            shape.setDefaultPrice(request.defaultPrice());
            // 色槽不在入参里：自定义品类的色槽由服务端分配，固定 4~7 不循环，
            // 客户端改不了（改了会让某个品类的颜色随别人增删而变）
        }
        shape.setUpdatedAt(LocalDateTime.now());
        // 复合主键 (openid, id)：必须带 openid 定位，不能用 updateById（规范 DB-04）
        shapeMapper.update(shape, new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .eq(Shape::getId, id));
        return ShapeVo.of(shape, usedCounts(openid).getOrDefault(id, 0));
    }

    /**
     * 删除品类。
     *
     * <p>内置的不能删。自定义品类删掉时，历史记录迁到「其他」
     * （PRD §5.4.1：删除时需先迁移历史记录）。
     */
    @Transactional
    public void delete(String openid, String id) {
        Shape shape = require(openid, id);
        if (shape.getIsBuiltin() != null && shape.getIsBuiltin() == 1) {
            throw new BizException(400, "内置品类不能删除，可以改名");
        }
        // 历史记录迁到「其他」，别让它们变成孤儿
        checkInMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<CheckIn>()
                .eq("openid", openid)
                .eq("shape_id", id)
                .set("shape_id", "shape_other")
                .set("updated_at", LocalDateTime.now()));
        shapeMapper.delete(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .eq(Shape::getId, id));
    }

    /** 按给定的 id 顺序重排。内置品类也可以调顺序（PRD §5.4.1） */
    @Transactional
    public void reorder(String openid, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < ids.size(); i++) {
            shapeMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<Shape>()
                    .eq("openid", openid)
                    .eq("id", ids.get(i))
                    .set("sort", i)
                    .set("updated_at", now));
        }
    }

    private Shape require(String openid, String id) {
        Shape shape = shapeMapper.selectOne(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .eq(Shape::getId, id)
                .isNull(Shape::getDeletedAt)
                .last("LIMIT 1"));
        if (shape == null) {
            throw BizException.notFound("品类不存在");
        }
        return shape;
    }

    /** 扩展槽里第一个没被占用的；全占了就拒绝新建 */
    private int freeExtensionSlot(List<Shape> existing) {
        for (int slot : CatalogPalette.EXTENSION_SLOTS) {
            boolean taken = existing.stream().anyMatch(s -> s.getSlot() != null && s.getSlot() == slot);
            if (!taken) {
                return slot;
            }
        }
        throw new BizException(400, "自定义品类最多 4 个");
    }

    private int nextSort(List<Shape> existing) {
        int max = existing.stream()
                .mapToInt(s -> s.getSort() == null ? 0 : s.getSort())
                .max()
                .orElse(-1);
        return max + 1;
    }

    /** 每个品类累计用了多少个 */
    private Map<String, Integer> usedCounts(String openid) {
        Map<String, Integer> counts = new HashMap<>();
        for (CheckIn row : checkInMapper.selectList(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .isNull(CheckIn::getDeletedAt))) {
            String key = row.getShapeId() == null ? "shape_other" : row.getShapeId();
            counts.merge(key, row.getCount() == null ? 0 : row.getCount(), Integer::sum);
        }
        return counts;
    }
}

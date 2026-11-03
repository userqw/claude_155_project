package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.TrashVo;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Material;
import com.nietu.daka.entity.Shape;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.MaterialMapper;
import com.nietu.daka.mapper.ShapeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 回收站。
 *
 * <p>软删除的记录在这里保留 **30 天**（PRD §5.1.3），到期由定时任务物理删除。
 * 用户也可以提前彻底删除。
 *
 * <p>天数按 **UTC** 算（规范 DB-03）：库里存的是 UTC，
 * 用本地时区算会差几个小时，30 天的边界因此会飘。
 */
@Service
public class TrashService {

    private final CheckInMapper checkInMapper;
    private final MaterialMapper materialMapper;
    private final ShapeMapper shapeMapper;

    public TrashService(CheckInMapper checkInMapper, MaterialMapper materialMapper,
                        ShapeMapper shapeMapper) {
        this.checkInMapper = checkInMapper;
        this.materialMapper = materialMapper;
        this.shapeMapper = shapeMapper;
    }

    /** 回收站列表：打卡记录 + 素材，按删除时间倒序 */
    public List<TrashVo> list(String openid) {
        List<TrashVo> items = new ArrayList<>();

        for (CheckIn row : checkInMapper.selectList(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .isNotNull(CheckIn::getDeletedAt))) {
            Shape shape = shapeMapper.selectOne(new LambdaQueryWrapper<Shape>()
                    .eq(Shape::getOpenid, openid)
                    .eq(Shape::getId, row.getShapeId())
                    .last("LIMIT 1"));
            items.add(new TrashVo(
                    "check_in",
                    row.getId(),
                    shape == null ? "手作记录" : shape.getName(),
                    "× " + (row.getCount() == null ? 0 : row.getCount()),
                    "",
                    row.getDate(),
                    row.getDeletedAt(),
                    daysAgo(row.getDeletedAt())
            ));
        }

        for (Material row : materialMapper.selectList(new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .isNotNull(Material::getDeletedAt))) {
            items.add(new TrashVo(
                    "material",
                    row.getId(),
                    row.getName() == null || row.getName().isBlank() ? "未命名素材" : row.getName(),
                    row.getNote() == null ? "" : row.getNote(),
                    row.getUrl() == null ? "" : row.getUrl(),
                    row.getCreatedAt() == null ? null : row.getCreatedAt().toLocalDate(),
                    row.getDeletedAt(),
                    daysAgo(row.getDeletedAt())
            ));
        }

        items.sort(Comparator.comparing(TrashVo::deletedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return items;
    }

    /** 彻底删除一条（物理删除，不可恢复） */
    @Transactional
    public void purge(String openid, String entityType, String id) {
        if ("check_in".equals(entityType)) {
            checkInMapper.delete(new LambdaQueryWrapper<CheckIn>()
                    .eq(CheckIn::getOpenid, openid)
                    .eq(CheckIn::getId, id));
            return;
        }
        if ("material".equals(entityType)) {
            materialMapper.delete(new LambdaQueryWrapper<Material>()
                    .eq(Material::getOpenid, openid)
                    .eq(Material::getId, id));
            return;
        }
        throw new BizException(400, "不支持的记录类型：" + entityType);
    }

    /** 清空回收站（物理删除全部已软删除的记录） */
    @Transactional
    public void purgeAll(String openid) {
        checkInMapper.delete(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .isNotNull(CheckIn::getDeletedAt));
        materialMapper.delete(new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .isNotNull(Material::getDeletedAt));
    }

    /** 已经过了几天。UTC 与本地差几小时，边界才不会飘 */
    private Integer daysAgo(LocalDateTime deletedAt) {
        if (deletedAt == null) {
            return 0;
        }
        return (int) ChronoUnit.DAYS.between(deletedAt.toLocalDate(), LocalDate.now(ZoneOffset.UTC));
    }
}

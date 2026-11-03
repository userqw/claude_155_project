package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nietu.daka.common.BizException;
import com.nietu.daka.common.PageResult;
import com.nietu.daka.dto.CheckInDto;
import com.nietu.daka.dto.CheckInVo;
import com.nietu.daka.dto.PhotoDto;
import com.nietu.daka.dto.SaleDto;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.CheckInTag;
import com.nietu.daka.entity.Photo;
import com.nietu.daka.entity.Sale;
import com.nietu.daka.entity.Shape;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.CheckInTagMapper;
import com.nietu.daka.mapper.PhotoMapper;
import com.nietu.daka.mapper.SaleMapper;
import com.nietu.daka.mapper.ShapeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 打卡记录的增删改查。删除是软删除，进 30 天回收站。 */
@Service
public class CheckInService {

    /** 每页最多多少条（规范 API-08：size 必须有上限） */
    private static final long MAX_PAGE_SIZE = 100L;

    private final CheckInMapper checkInMapper;
    private final PhotoMapper photoMapper;
    private final SaleMapper saleMapper;
    private final CheckInTagMapper checkInTagMapper;
    private final ShapeMapper shapeMapper;
    private final DeviceService deviceService;

    public CheckInService(CheckInMapper checkInMapper, PhotoMapper photoMapper,
                          SaleMapper saleMapper, CheckInTagMapper checkInTagMapper,
                          ShapeMapper shapeMapper, DeviceService deviceService) {
        this.checkInMapper = checkInMapper;
        this.photoMapper = photoMapper;
        this.saleMapper = saleMapper;
        this.checkInTagMapper = checkInTagMapper;
        this.shapeMapper = shapeMapper;
        this.deviceService = deviceService;
    }

    /**
     * 分页查询。
     *
     * <p>按年过滤用**日期范围**而不是 {@code YEAR(date) = ?}：
     * 函数包在列上就用不了索引（规范 DB-06），数据量一大就全表扫。
     *
     * <p>出参是 VO 不是 Entity（规范 API-02）。
     */
    public PageResult<CheckInVo> list(String openid, Integer year, String shapeId,
                                      long page, long size) {
        // 每页条数上限：不让 size=999999 把数据库拖垮（规范 API-08）
        long safeSize = Math.min(Math.max(size, 1L), MAX_PAGE_SIZE);
        long safePage = Math.max(page, 1L);

        LambdaQueryWrapper<CheckIn> query = new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .isNull(CheckIn::getDeletedAt);
        if (year != null) {
            query.ge(CheckIn::getDate, LocalDate.of(year, 1, 1))
                    .lt(CheckIn::getDate, LocalDate.of(year + 1, 1, 1));
        }
        if (shapeId != null && !shapeId.isBlank()) {
            query.eq(CheckIn::getShapeId, shapeId);
        }
        query.orderByDesc(CheckIn::getDate).orderByDesc(CheckIn::getCreatedAt);
        Page<CheckIn> result = checkInMapper.selectPage(new Page<>(safePage, safeSize), query);

        Map<String, String> shapeNames = new HashMap<>();
        for (Shape shape : shapeMapper.selectList(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .isNull(Shape::getDeletedAt))) {
            shapeNames.put(shape.getId(), shape.getName());
        }
        Map<String, Integer> soldMap = soldCounts(openid);

        List<CheckInVo> records = result.getRecords().stream()
                .map(row -> CheckInVo.of(row,
                        shapeNames.getOrDefault(row.getShapeId(), "其他"),
                        soldMap.getOrDefault(row.getId(), 0)))
                .toList();
        return PageResult.of(records, result.getTotal(), safePage, safeSize);
    }

    /** 每条记录已售出的数量 */
    private Map<String, Integer> soldCounts(String openid) {
        Map<String, Integer> counts = new HashMap<>();
        for (Sale sale : saleMapper.selectList(new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .isNull(Sale::getDeletedAt))) {
            counts.merge(sale.getCheckInId(), sale.getQuantity() == null ? 0 : sale.getQuantity(),
                    Integer::sum);
        }
        return counts;
    }

    @Transactional
    public CheckInDto create(String openid, CheckInDto dto) {
        LocalDateTime now = LocalDateTime.now();
        CheckIn row = new CheckIn();
        row.setOpenid(openid);
        row.setId(dto.id() == null || dto.id().isBlank() ? uid("ci") : dto.id());
        row.setDate(dto.date());
        row.setShapeId(dto.shapeId());
        row.setCount(dto.count() == null ? 1 : dto.count());
        row.setNote(dto.note() == null ? "" : dto.note());
        row.setDurationMin(dto.durationMin());
        row.setCoverPhotoId(dto.coverPhotoId());
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        checkInMapper.insert(row);

        replacePhotos(openid, row.getId(), dto.photos(), now);
        replaceTags(openid, row.getId(), dto.tagIds(), now);
        replaceSales(openid, row.getId(), dto.sales(), now);
        // 返回**落库后**的记录：id 是服务端生成的，入参里没有，
        // 直接把入参原样返回的话客户端拿不到自己刚建的记录（规范 API-09）
        return toDto(row, dto);
    }

    /** 按落库的记录组装出参 */
    private CheckInDto toDto(CheckIn row, CheckInDto source) {
        return new CheckInDto(
                row.getId(),
                row.getDate(),
                row.getShapeId(),
                row.getCount(),
                row.getNote(),
                row.getDurationMin(),
                row.getCoverPhotoId(),
                source == null ? null : source.tagIds(),
                source == null ? null : source.photos(),
                source == null ? null : source.sales(),
                false,
                row.getUpdatedAt(),
                null
        );
    }

    @Transactional
    public CheckInDto update(String openid, String id, CheckInDto dto) {
        CheckIn row = require(openid, id);
        if (dto.date() != null) {
            row.setDate(dto.date());
        }
        if (dto.shapeId() != null) {
            row.setShapeId(dto.shapeId());
        }
        if (dto.count() != null) {
            row.setCount(dto.count());
        }
        if (dto.note() != null) {
            row.setNote(dto.note());
        }
        row.setDurationMin(dto.durationMin());
        row.setCoverPhotoId(dto.coverPhotoId());
        row.setUpdatedAt(LocalDateTime.now());
        // 复合主键 (openid, id)：必须带 openid 定位，不能用 updateById
        checkInMapper.update(row, new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .eq(CheckIn::getId, id));

        if (dto.photos() != null) {
            replacePhotos(openid, id, dto.photos(), row.getUpdatedAt());
        }
        if (dto.tagIds() != null) {
            replaceTags(openid, id, dto.tagIds(), row.getUpdatedAt());
        }
        return toDto(row, dto);
    }

    /** 软删除：置 deleted_at，回收站保留 30 天 */
    public void delete(String openid, String id) {
        CheckIn row = require(openid, id);
        row.setDeletedAt(LocalDateTime.now());
        row.setUpdatedAt(row.getDeletedAt());
        checkInMapper.update(row, new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .eq(CheckIn::getId, id));
    }

    public void restore(String openid, String id) {
        require(openid, id);
        // 恢复要把 deleted_at 清成 NULL，但 MyBatis-Plus 默认字段策略是 NOT_NULL：
        // null 字段会被跳过，setDeletedAt(null) 根本不会出现在 SQL 里，
        // 记录会一直躺在回收站。所以用 UpdateWrapper 显式 set。
        UpdateWrapper<CheckIn> wrapper = new UpdateWrapper<>();
        wrapper.eq("openid", openid)
                .eq("id", id)
                .set("deleted_at", null)
                .set("updated_at", LocalDateTime.now());
        checkInMapper.update(null, wrapper);
    }

    public CheckIn require(String openid, String id) {
        CheckIn row = checkInMapper.selectOne(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .eq(CheckIn::getId, id)
                .last("LIMIT 1"));
        if (row == null) {
            throw BizException.notFound("记录不存在");
        }
        return row;
    }

    private void replacePhotos(String openid, String checkInId, List<PhotoDto> photos, LocalDateTime now) {
        if (photos == null) {
            return;
        }
        photoMapper.delete(new LambdaQueryWrapper<Photo>()
                .eq(Photo::getOpenid, openid)
                .eq(Photo::getCheckInId, checkInId));
        int sort = 0;
        for (PhotoDto dto : photos) {
            Photo photo = new Photo();
            photo.setOpenid(openid);
            photo.setId(dto.id() == null || dto.id().isBlank() ? uid("ph") : dto.id());
            photo.setCheckInId(checkInId);
            photo.setUrl(dto.url());
            photo.setLocalPath(dto.localPath());
            photo.setWidth(dto.width() == null ? 0 : dto.width());
            photo.setHeight(dto.height() == null ? 0 : dto.height());
            photo.setSort(dto.sort() == null ? sort : dto.sort());
            photo.setCreatedAt(now);
            photo.setUpdatedAt(now);
            photoMapper.insert(photo);
            sort++;
        }
    }

    private void replaceTags(String openid, String checkInId, List<String> tagIds, LocalDateTime now) {
        if (tagIds == null) {
            return;
        }
        checkInTagMapper.delete(new LambdaQueryWrapper<CheckInTag>()
                .eq(CheckInTag::getOpenid, openid)
                .eq(CheckInTag::getCheckInId, checkInId));
        for (String tagId : tagIds) {
            CheckInTag link = new CheckInTag();
            link.setOpenid(openid);
            link.setCheckInId(checkInId);
            link.setTagId(tagId);
            link.setCreatedAt(now);
            checkInTagMapper.insert(link);
        }
    }

    private void replaceSales(String openid, String checkInId, List<SaleDto> sales, LocalDateTime now) {
        if (sales == null) {
            return;
        }
        for (SaleDto dto : sales) {
            Sale sale = new Sale();
            sale.setOpenid(openid);
            sale.setId(dto.id() == null || dto.id().isBlank() ? uid("sale") : dto.id());
            sale.setCheckInId(checkInId);
            sale.setQuantity(dto.quantity() == null ? 1 : dto.quantity());
            sale.setUnitPrice(dto.unitPrice() == null ? BigDecimal.ZERO : dto.unitPrice());
            sale.setTotalAmount(sale.getUnitPrice().multiply(BigDecimal.valueOf(sale.getQuantity())));
            sale.setSoldDate(dto.soldDate());
            sale.setChannel(dto.channel() == null ? "other" : dto.channel());
            sale.setNote(dto.note() == null ? "" : dto.note());
            sale.setCreatedAt(now);
            sale.setUpdatedAt(now);
            saleMapper.insert(sale);
        }
    }

    static String uid(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}

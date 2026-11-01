package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.dto.CheckInDto;
import com.nietu.daka.dto.FolderDto;
import com.nietu.daka.dto.MaterialDto;
import com.nietu.daka.dto.PhotoDto;
import com.nietu.daka.dto.SaleDto;
import com.nietu.daka.dto.ShapeDto;
import com.nietu.daka.dto.SyncPullResponse;
import com.nietu.daka.dto.SyncPushRequest;
import com.nietu.daka.dto.TagDto;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Material;
import com.nietu.daka.entity.MaterialFolder;
import com.nietu.daka.entity.Photo;
import com.nietu.daka.entity.Sale;
import com.nietu.daka.entity.Shape;
import com.nietu.daka.entity.Tag;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.MaterialFolderMapper;
import com.nietu.daka.mapper.MaterialMapper;
import com.nietu.daka.mapper.PhotoMapper;
import com.nietu.daka.mapper.SaleMapper;
import com.nietu.daka.mapper.ShapeMapper;
import com.nietu.daka.mapper.SyncMapper;
import com.nietu.daka.mapper.TagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 云端同步（PRD §5.6.2 的 /api/sync/push 与 /api/sync/pull）。
 *
 * <p>推送按 updated_at 做字段级合并，后写覆盖先写；售出记录追加型只插不改。
 * 拉取按 updated_at 增量，软删除的墓碑也要拉走，否则删除动作同步不过去。
 */
@Service
public class SyncService {

    private final SyncMapper syncMapper;
    private final CheckInMapper checkInMapper;
    private final PhotoMapper photoMapper;
    private final SaleMapper saleMapper;
    private final ShapeMapper shapeMapper;
    private final TagMapper tagMapper;
    private final MaterialMapper materialMapper;
    private final MaterialFolderMapper folderMapper;
    private final DeviceService deviceService;

    public SyncService(SyncMapper syncMapper, CheckInMapper checkInMapper, PhotoMapper photoMapper,
                       SaleMapper saleMapper, ShapeMapper shapeMapper, TagMapper tagMapper,
                       MaterialMapper materialMapper, MaterialFolderMapper folderMapper,
                       DeviceService deviceService) {
        this.syncMapper = syncMapper;
        this.checkInMapper = checkInMapper;
        this.photoMapper = photoMapper;
        this.saleMapper = saleMapper;
        this.shapeMapper = shapeMapper;
        this.tagMapper = tagMapper;
        this.materialMapper = materialMapper;
        this.folderMapper = folderMapper;
        this.deviceService = deviceService;
    }

    @Transactional
    public Map<String, Object> push(String openid, SyncPushRequest request) {
        LocalDateTime now = LocalDateTime.now();
        // The device row may be new - register it before writing anything
        deviceService.ensure(openid, request.deviceId());
        Map<String, Object> result = new LinkedHashMap<>();
        int checkIns = 0;
        int photos = 0;
        int sales = 0;
        int folders = 0;
        int materials = 0;

        if (request.checkIns() != null) {
            for (CheckInDto dto : request.checkIns()) {
                CheckIn row = new CheckIn();
                row.setOpenid(openid);
                row.setId(dto.id() == null || dto.id().isBlank() ? CheckInService.uid("ci") : dto.id());
                row.setDate(dto.date());
                row.setShapeId(dto.shapeId());
                row.setCount(dto.count() == null ? 1 : dto.count());
                row.setNote(dto.note() == null ? "" : dto.note());
                row.setDurationMin(dto.durationMin());
                row.setCoverPhotoId(dto.coverPhotoId());
                row.setDeviceId(request.deviceId());
                row.setCreatedAt(now);
                // Merge decision must use the CLIENT timestamp.
                // Using the server clock makes every push win, so an older
                // client version could never be uploaded again.
                row.setUpdatedAt(dto.updatedAt() == null ? now : dto.updatedAt());
                // 客户端用 deletedAt 字段标记删除，两种都认
                boolean deleted = Boolean.TRUE.equals(dto.deleted()) || dto.deletedAt() != null;
                row.setDeletedAt(deleted ? now : null);
                syncMapper.upsertCheckIn(row);
                checkIns++;

                if (dto.photos() != null) {
                    for (PhotoDto p : dto.photos()) {
                        Photo photo = new Photo();
                        photo.setOpenid(openid);
                        photo.setId(p.id() == null || p.id().isBlank() ? CheckInService.uid("ph") : p.id());
                        photo.setCheckInId(row.getId());
                        photo.setUrl(p.url());
                        photo.setLocalPath(p.localPath());
                        photo.setWidth(p.width() == null ? 0 : p.width());
                        photo.setHeight(p.height() == null ? 0 : p.height());
                        photo.setSort(p.sort() == null ? 0 : p.sort());
                        photo.setCreatedAt(now);
                        photo.setUpdatedAt(p.updatedAt() == null ? now : p.updatedAt());
                        syncMapper.upsertPhoto(photo);
                        photos++;
                    }
                }
                if (dto.tagIds() != null) {
                    syncMapper.deleteCheckInTags(openid, row.getId());
                    for (String tagId : dto.tagIds()) {
                        syncMapper.insertCheckInTag(openid, row.getId(), tagId, now);
                    }
                }
                if (dto.sales() != null) {
                    for (SaleDto s : dto.sales()) {
                        syncMapper.insertSaleIgnore(toSale(openid, s, now, request.deviceId()));
                        sales++;
                    }
                }
            }
        }

        if (request.photos() != null) {
            for (PhotoDto p : request.photos()) {
                Photo photo = new Photo();
                photo.setOpenid(openid);
                photo.setId(p.id() == null || p.id().isBlank() ? CheckInService.uid("ph") : p.id());
                // 顶层 photos 是前端单独上传的照片集合，check_in_id 要用前端带来的值，
                // 写空串会撞 photo.check_in_id 的外键
                photo.setCheckInId(p.checkInId() == null ? "" : p.checkInId());
                photo.setUrl(p.url());
                photo.setLocalPath(p.localPath());
                photo.setWidth(p.width() == null ? 0 : p.width());
                photo.setHeight(p.height() == null ? 0 : p.height());
                photo.setSort(p.sort() == null ? 0 : p.sort());
                photo.setCreatedAt(now);
                photo.setUpdatedAt(now);
                syncMapper.upsertPhoto(photo);
                photos++;
            }
        }

        if (request.sales() != null) {
            for (SaleDto s : request.sales()) {
                syncMapper.insertSaleIgnore(toSale(openid, s, now, request.deviceId()));
                sales++;
            }
        }

        if (request.folders() != null) {
            for (FolderDto f : request.folders()) {
                MaterialFolder row = new MaterialFolder();
                row.setOpenid(openid);
                row.setId(f.id() == null || f.id().isBlank() ? CheckInService.uid("mf") : f.id());
                row.setName(f.name() == null ? "新文件夹" : f.name());
                row.setSort(f.sort() == null ? 0 : f.sort());
                row.setCoverMaterialId(f.coverMaterialId());
                row.setCreatedAt(now);
                row.setUpdatedAt(f.updatedAt() == null ? now : f.updatedAt());
                syncMapper.upsertFolder(row);
                folders++;
            }
        }

        if (request.materials() != null) {
            for (MaterialDto m : request.materials()) {
                Material row = new Material();
                row.setOpenid(openid);
                row.setId(m.id() == null || m.id().isBlank() ? CheckInService.uid("mt") : m.id());
                row.setFolderId(m.folderId() == null || m.folderId().isBlank() ? null : m.folderId());
                row.setUrl(m.url());
                row.setLocalPath(m.localPath());
                row.setName(m.name() == null ? "" : m.name());
                row.setNote(m.note() == null ? "" : m.note());
                row.setCreatedAt(now);
                row.setUpdatedAt(m.updatedAt() == null ? now : m.updatedAt());
                syncMapper.upsertMaterial(row);
                materials++;
            }
        }

        result.put("checkIns", checkIns);
        result.put("photos", photos);
        result.put("sales", sales);
        result.put("folders", folders);
        result.put("materials", materials);
        result.put("serverTime", LocalDateTime.now());
        return result;
    }

    private Sale toSale(String openid, SaleDto dto, LocalDateTime now, String deviceId) {
        Sale sale = new Sale();
        sale.setOpenid(openid);
        sale.setId(dto.id() == null || dto.id().isBlank() ? CheckInService.uid("sale") : dto.id());
        sale.setCheckInId(dto.checkInId());
        sale.setQuantity(dto.quantity() == null ? 1 : dto.quantity());
        sale.setUnitPrice(dto.unitPrice() == null ? BigDecimal.ZERO : dto.unitPrice());
        sale.setTotalAmount(sale.getUnitPrice().multiply(BigDecimal.valueOf(sale.getQuantity())));
        sale.setSoldDate(dto.soldDate());
        sale.setChannel(dto.channel() == null ? "other" : dto.channel());
        sale.setNote(dto.note() == null ? "" : dto.note());
        sale.setDeviceId(deviceId);
        sale.setCreatedAt(now);
        sale.setUpdatedAt(dto.updatedAt() == null ? now : dto.updatedAt());
        return sale;
    }

    /** 增量拉取。since 为空表示全量。 */
    public SyncPullResponse pull(String openid, LocalDateTime since) {
        List<CheckIn> checkInRows = checkInMapper.selectList(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .gt(CheckIn::getUpdatedAt, since)
                .orderByAsc(CheckIn::getUpdatedAt));
        List<Photo> photoRows = photoMapper.selectList(new LambdaQueryWrapper<Photo>()
                .eq(Photo::getOpenid, openid)
                .gt(Photo::getUpdatedAt, since)
                .orderByAsc(Photo::getUpdatedAt));
        List<Sale> saleRows = saleMapper.selectList(new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .gt(Sale::getUpdatedAt, since)
                .orderByAsc(Sale::getUpdatedAt));
        List<MaterialFolder> folderRows = folderMapper.selectList(new LambdaQueryWrapper<MaterialFolder>()
                .eq(MaterialFolder::getOpenid, openid)
                .gt(MaterialFolder::getUpdatedAt, since)
                .orderByAsc(MaterialFolder::getUpdatedAt));
        List<Material> materialRows = materialMapper.selectList(new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .gt(Material::getUpdatedAt, since)
                .orderByAsc(Material::getUpdatedAt));

        List<Shape> shapes = shapeMapper.selectList(new LambdaQueryWrapper<Shape>()
                .eq(Shape::getOpenid, openid)
                .isNull(Shape::getDeletedAt)
                .orderByAsc(Shape::getSort));
        List<Tag> tags = tagMapper.selectList(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getOpenid, openid)
                .isNull(Tag::getDeletedAt));

        List<CheckInDto> checkIns = new ArrayList<>();
        for (CheckIn row : checkInRows) {
            checkIns.add(new CheckInDto(row.getId(), row.getDate(), row.getShapeId(), row.getCount(),
                    row.getNote(), row.getDurationMin(), row.getCoverPhotoId(),
                    List.of(), List.of(), List.of(), row.getDeletedAt() != null,
                    row.getUpdatedAt(), null));
        }
        List<PhotoDto> photos = new ArrayList<>();
        for (Photo row : photoRows) {
            photos.add(new PhotoDto(row.getId(), row.getUrl(), row.getLocalPath(),
                    row.getWidth(), row.getHeight(), row.getSort(), row.getUpdatedAt(),
                    row.getCheckInId()));
        }
        List<SaleDto> sales = new ArrayList<>();
        for (Sale row : saleRows) {
            sales.add(new SaleDto(row.getId(), row.getCheckInId(), row.getQuantity(),
                    row.getUnitPrice(), row.getSoldDate(), row.getChannel(), row.getNote(),
                    row.getUpdatedAt()));
        }
        List<FolderDto> folders = new ArrayList<>();
        for (MaterialFolder row : folderRows) {
            folders.add(new FolderDto(row.getId(), row.getName(), row.getSort(),
                    row.getCoverMaterialId(), row.getUpdatedAt()));
        }
        List<MaterialDto> materials = new ArrayList<>();
        for (Material row : materialRows) {
            materials.add(new MaterialDto(row.getId(), row.getFolderId(), row.getUrl(),
                    row.getLocalPath(), row.getName(), row.getNote(), row.getUpdatedAt()));
        }
        List<ShapeDto> shapeDtos = new ArrayList<>();
        for (Shape row : shapes) {
            shapeDtos.add(new ShapeDto(row.getId(), row.getName(), row.getIcon(), row.getIconPath(),
                    row.getColor(), row.getSlot(), row.getDefaultPrice(), row.getSort(), row.getIsBuiltin()));
        }
        List<TagDto> tagDtos = new ArrayList<>();
        for (Tag row : tags) {
            tagDtos.add(new TagDto(row.getId(), row.getName(), row.getColor(), row.getIsBuiltin()));
        }

        return new SyncPullResponse(LocalDateTime.now(), checkIns, sales, photos,
                folders, materials, shapeDtos, tagDtos);
    }
}

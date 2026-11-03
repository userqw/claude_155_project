package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.FolderDto;
import com.nietu.daka.dto.MaterialDto;
import com.nietu.daka.entity.Material;
import com.nietu.daka.entity.MaterialFolder;
import com.nietu.daka.mapper.MaterialFolderMapper;
import com.nietu.daka.mapper.MaterialMapper;
import com.nietu.daka.mapper.SyncMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 素材库。
 *
 * <p>只有一层文件夹（PRD §5.7.2）；删文件夹不删素材，素材转「未分类」。
 */
@Service
public class MaterialService {

    private final MaterialFolderMapper folderMapper;
    private final MaterialMapper materialMapper;
    private final SyncMapper syncMapper;

    public MaterialService(MaterialFolderMapper folderMapper, MaterialMapper materialMapper, SyncMapper syncMapper) {
        this.folderMapper = folderMapper;
        this.materialMapper = materialMapper;
        this.syncMapper = syncMapper;
    }

    public List<MaterialFolder> listFolders(String openid) {
        return folderMapper.selectList(new LambdaQueryWrapper<MaterialFolder>()
                .eq(MaterialFolder::getOpenid, openid)
                .isNull(MaterialFolder::getDeletedAt)
                .orderByAsc(MaterialFolder::getSort));
    }

    /**
     * 素材列表。
     *
     * <p>{@code folderId} 的三种语义（前端 {@code db.js} 也是这么约定的）：
     * <ul>
     *   <li>{@code null} / 不传 —— 全部素材</li>
     *   <li>空串 —— **未分类**（库里 folder_id 是 NULL）</li>
     *   <li>具体 id —— 该文件夹下的素材</li>
     * </ul>
     * 之前空串被当成「不筛选」，于是永远查不出「未分类」那一批。
     */
    public List<Material> listMaterials(String openid, String folderId) {
        LambdaQueryWrapper<Material> query = new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .isNull(Material::getDeletedAt);
        if (folderId == null) {
            // 不筛选
        } else if (folderId.isBlank()) {
            query.isNull(Material::getFolderId);
        } else {
            query.eq(Material::getFolderId, folderId);
        }
        query.orderByDesc(Material::getCreatedAt);
        return materialMapper.selectList(query);
    }

    @Transactional
    public FolderDto createFolder(String openid, FolderDto dto) {
        LocalDateTime now = LocalDateTime.now();
        MaterialFolder row = new MaterialFolder();
        row.setOpenid(openid);
        row.setId(dto.id() == null || dto.id().isBlank() ? CheckInService.uid("mf") : dto.id());
        row.setName(dto.name() == null || dto.name().isBlank() ? "新文件夹" : dto.name());
        row.setSort(dto.sort() == null ? 0 : dto.sort());
        row.setCoverMaterialId(dto.coverMaterialId());
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        folderMapper.insert(row);
        // 返回落库后的：id 是服务端生成的，入参里没有
        return new FolderDto(row.getId(), row.getName(), row.getSort(),
                row.getCoverMaterialId(), row.getUpdatedAt());
    }

    @Transactional
    public void deleteFolder(String openid, String id) {
        MaterialFolder row = requireFolder(openid, id);
        // 删文件夹不删素材：先把素材转到未分类
        syncMapper.moveMaterialsToUnfiled(openid, id);
        row.setDeletedAt(LocalDateTime.now());
        row.setUpdatedAt(row.getDeletedAt());
        folderMapper.update(row, new LambdaQueryWrapper<MaterialFolder>()
                .eq(MaterialFolder::getOpenid, openid)
                .eq(MaterialFolder::getId, id));
    }

    @Transactional
    public MaterialDto saveMaterial(String openid, MaterialDto dto) {
        LocalDateTime now = LocalDateTime.now();
        Material row = new Material();
        row.setOpenid(openid);
        row.setId(dto.id() == null || dto.id().isBlank() ? CheckInService.uid("mt") : dto.id());
        row.setFolderId(dto.folderId() == null || dto.folderId().isBlank() ? null : dto.folderId());
        row.setUrl(dto.url());
        row.setLocalPath(dto.localPath());
        row.setName(dto.name() == null ? "" : dto.name());
        row.setNote(dto.note() == null ? "" : dto.note());
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        materialMapper.insert(row);
        // 返回落库后的：id 是服务端生成的，入参里没有
        return new MaterialDto(row.getId(), row.getFolderId(), row.getUrl(), row.getLocalPath(),
                row.getName(), row.getNote(), row.getUpdatedAt());
    }

    /**
     * 修改素材的名称、备注与所属文件夹。
     *
     * <p>图���本身不变（url / localPath 是当初选图时就定下的），
     * 所以这里只改用户能改的三个字段。
     */
    @Transactional
    public MaterialDto updateMaterial(String openid, String id, MaterialDto dto) {
        Material row = requireMaterial(openid, id);
        if (dto.name() != null) {
            row.setName(dto.name());
        }
        if (dto.note() != null) {
            row.setNote(dto.note());
        }
        if (dto.folderId() != null) {
            row.setFolderId(dto.folderId().isBlank() ? null : dto.folderId());
        }
        row.setUpdatedAt(LocalDateTime.now());
        // 复合主键 (openid, id)：必须带 openid 定位，不能用 updateById（规范 DB-04）
        materialMapper.update(row, new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .eq(Material::getId, id));
        return dto;
    }

    /** 文件夹改名 */
    @Transactional
    public FolderDto renameFolder(String openid, String id, String name) {
        MaterialFolder row = requireFolder(openid, id);
        row.setName(name == null || name.isBlank() ? row.getName() : name.trim());
        row.setUpdatedAt(LocalDateTime.now());
        folderMapper.update(row, new LambdaQueryWrapper<MaterialFolder>()
                .eq(MaterialFolder::getOpenid, openid)
                .eq(MaterialFolder::getId, id));
        return new FolderDto(row.getId(), row.getName(), row.getSort(),
                row.getCoverMaterialId(), row.getUpdatedAt());
    }

    /** 按给定的 id 顺序重排文件夹 */
    @Transactional
    public void reorderFolders(String openid, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < ids.size(); i++) {
            folderMapper.update(null, new UpdateWrapper<MaterialFolder>()
                    .eq("openid", openid)
                    .eq("id", ids.get(i))
                    .set("sort", i)
                    .set("updated_at", now));
        }
    }

    private Material requireMaterial(String openid, String id) {
        Material row = materialMapper.selectOne(new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .eq(Material::getId, id)
                .isNull(Material::getDeletedAt)
                .last("LIMIT 1"));
        if (row == null) {
            throw BizException.notFound("素材不存在");
        }
        return row;
    }

    public void deleteMaterial(String openid, String id) {
        Material row = materialMapper.selectOne(new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .eq(Material::getId, id)
                .last("LIMIT 1"));
        if (row == null) {
            throw BizException.notFound("素材不存在");
        }
        row.setDeletedAt(LocalDateTime.now());
        row.setUpdatedAt(row.getDeletedAt());
        materialMapper.update(row, new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .eq(Material::getId, id));
    }

    private MaterialFolder requireFolder(String openid, String id) {
        MaterialFolder row = folderMapper.selectOne(new LambdaQueryWrapper<MaterialFolder>()
                .eq(MaterialFolder::getOpenid, openid)
                .eq(MaterialFolder::getId, id)
                .last("LIMIT 1"));
        if (row == null) {
            throw BizException.notFound("文件夹不存在");
        }
        return row;
    }
}

package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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

    public List<Material> listMaterials(String openid, String folderId) {
        LambdaQueryWrapper<Material> query = new LambdaQueryWrapper<Material>()
                .eq(Material::getOpenid, openid)
                .isNull(Material::getDeletedAt);
        if (folderId != null && !folderId.isBlank()) {
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
        return dto;
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
        return dto;
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

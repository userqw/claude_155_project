package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.FolderDto;
import com.nietu.daka.dto.ReorderRequest;
import com.nietu.daka.dto.MaterialDto;
import com.nietu.daka.entity.Material;
import com.nietu.daka.entity.MaterialFolder;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.MaterialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 素材库。
 *
 * <p>只有一层文件夹；删文件夹不删素材，素材转「未分类」（PRD §5.7）。
 */
@Tag(name = "素材库")
@RestController
@RequestMapping("/api/material")
public class MaterialController {

    private final MaterialService materialService;

    public MaterialController(MaterialService materialService) {
        this.materialService = materialService;
    }

    @Operation(summary = "文件夹列表")
    @GetMapping("/folder")
    public Result<List<MaterialFolder>> folders() {
        return Result.ok(materialService.listFolders(AuthContext.require()));
    }

    @Operation(summary = "新建文件夹")
    @PostMapping("/folder")
    public Result<FolderDto> createFolder(@RequestBody FolderDto dto) {
        return Result.ok(materialService.createFolder(AuthContext.require(), dto));
    }

    @Operation(summary = "文件夹改名")
    @PutMapping("/folder/{id}")
    public Result<FolderDto> renameFolder(@PathVariable String id, @RequestBody FolderDto dto) {
        return Result.ok(materialService.renameFolder(AuthContext.require(), id, dto.name()));
    }

    @Operation(summary = "调整文件夹顺序")
    @PostMapping("/folder/reorder")
    public Result<Void> reorderFolders(@RequestBody @Valid ReorderRequest request) {
        materialService.reorderFolders(AuthContext.require(), request.ids());
        return Result.ok();
    }

    @Operation(summary = "删除文件夹（素材转为未分类，不删除素材）")
    @DeleteMapping("/folder/{id}")
    public Result<Void> deleteFolder(@PathVariable String id) {
        materialService.deleteFolder(AuthContext.require(), id);
        return Result.ok();
    }

    @Operation(summary = "素材列表，可按文件夹过滤")
    @GetMapping
    public Result<List<Material>> materials(@RequestParam(required = false) String folderId) {
        return Result.ok(materialService.listMaterials(AuthContext.require(), folderId));
    }

    @Operation(summary = "新增素材")
    @PostMapping
    public Result<MaterialDto> createMaterial(@RequestBody MaterialDto dto) {
        return Result.ok(materialService.saveMaterial(AuthContext.require(), dto));
    }

    @Operation(summary = "修改素材的名称、备注与所属文件夹")
    @PutMapping("/{id}")
    public Result<MaterialDto> updateMaterial(@PathVariable String id, @RequestBody MaterialDto dto) {
        return Result.ok(materialService.updateMaterial(AuthContext.require(), id, dto));
    }

    @Operation(summary = "删除素材（软删除）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteMaterial(@PathVariable String id) {
        materialService.deleteMaterial(AuthContext.require(), id);
        return Result.ok();
    }
}

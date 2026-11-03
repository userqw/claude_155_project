package com.nietu.daka.controller;

import com.nietu.daka.common.Result;
import com.nietu.daka.dto.TagRequest;
import com.nietu.daka.dto.TagVo;
import com.nietu.daka.security.AuthContext;
import com.nietu.daka.service.TagService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 标签管理。
 *
 * <p>内置标签不可删，可改名改色；自定义标签可增删改。
 */
@Tag(name = "标签")
@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @Operation(summary = "列出全部标签，带每个标签的引用条数")
    @GetMapping
    public Result<List<TagVo>> list() {
        return Result.ok(tagService.list(AuthContext.require()));
    }

    @Operation(summary = "新建标签")
    @PostMapping
    public Result<TagVo> create(@RequestBody @Valid TagRequest request) {
        return Result.ok(tagService.create(AuthContext.require(), request));
    }

    @Operation(summary = "修改标签")
    @PutMapping("/{id}")
    public Result<TagVo> update(@PathVariable String id, @RequestBody @Valid TagRequest request) {
        return Result.ok(tagService.update(AuthContext.require(), id, request));
    }

    @Operation(summary = "删除标签（内置的不可删）")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        tagService.delete(AuthContext.require(), id);
        return Result.ok();
    }
}

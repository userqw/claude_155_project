package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.TagRequest;
import com.nietu.daka.dto.TagVo;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.CheckInTag;
import com.nietu.daka.entity.Tag;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.CheckInTagMapper;
import com.nietu.daka.mapper.TagMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 标签管理。
 *
 * <p>规则（PRD §5.6.2 / §6.2）：内置标签不可删，可改名改色；
 * 自定义标签可增删改。
 *
 * <p>所有查询都带 openid（规范 DB-04）。
 */
@Service
public class TagService {

    private final TagMapper tagMapper;
    private final CheckInMapper checkInMapper;
    private final CheckInTagMapper checkInTagMapper;

    public TagService(TagMapper tagMapper, CheckInMapper checkInMapper,
                      CheckInTagMapper checkInTagMapper) {
        this.tagMapper = tagMapper;
        this.checkInMapper = checkInMapper;
        this.checkInTagMapper = checkInTagMapper;
    }

    /** 列出全部标签，附带每个标签用了几条记录 */
    public List<TagVo> list(String openid) {
        List<Tag> tags = tagMapper.selectList(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getOpenid, openid)
                .isNull(Tag::getDeletedAt)
                .orderByAsc(Tag::getCreatedAt));
        Map<String, Integer> used = usedCounts(openid);
        return tags.stream()
                .map(t -> TagVo.of(t, used.getOrDefault(t.getId(), 0)))
                .toList();
    }

    @Transactional
    public TagVo create(String openid, TagRequest request) {
        LocalDateTime now = LocalDateTime.now();
        Tag tag = new Tag();
        tag.setOpenid(openid);
        tag.setId("tag_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        tag.setName(request.name().trim());
        tag.setColor(request.color() == null || request.color().isBlank() ? "#898781" : request.color());
        tag.setIsBuiltin(0);
        tag.setCreatedAt(now);
        tag.setUpdatedAt(now);
        tagMapper.insert(tag);
        return TagVo.of(tag, 0);
    }

    @Transactional
    public TagVo update(String openid, String id, TagRequest request) {
        Tag tag = require(openid, id);
        tag.setName(request.name().trim());
        if (request.color() != null && !request.color().isBlank()) {
            tag.setColor(request.color());
        }
        tag.setUpdatedAt(LocalDateTime.now());
        tagMapper.update(tag, new LambdaQueryWrapper<Tag>()
                .eq(Tag::getOpenid, openid)
                .eq(Tag::getId, id));
        return TagVo.of(tag, usedCounts(openid).getOrDefault(id, 0));
    }

    /** 删除标签。内置的不能删；自定义的删掉时解除记录上的引用 */
    @Transactional
    public void delete(String openid, String id) {
        Tag tag = require(openid, id);
        if (tag.getIsBuiltin() != null && tag.getIsBuiltin() == 1) {
            throw new BizException(400, "内置标签不能删除，可以改名");
        }
        checkInTagMapper.delete(new LambdaQueryWrapper<CheckInTag>()
                .eq(CheckInTag::getOpenid, openid)
                .eq(CheckInTag::getTagId, id));
        tagMapper.delete(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getOpenid, openid)
                .eq(Tag::getId, id));
    }

    private Tag require(String openid, String id) {
        Tag tag = tagMapper.selectOne(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getOpenid, openid)
                .eq(Tag::getId, id)
                .isNull(Tag::getDeletedAt)
                .last("LIMIT 1"));
        if (tag == null) {
            throw BizException.notFound("标签不存在");
        }
        return tag;
    }

    /** 每个标签被多少条记录引用 */
    private Map<String, Integer> usedCounts(String openid) {
        Map<String, Integer> counts = new HashMap<>();
        List<CheckIn> alive = checkInMapper.selectList(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .isNull(CheckIn::getDeletedAt));
        if (alive.isEmpty()) {
            return counts;
        }
        for (CheckInTag link : checkInTagMapper.selectList(new LambdaQueryWrapper<CheckInTag>()
                .eq(CheckInTag::getOpenid, openid))) {
            boolean stillAlive = alive.stream().anyMatch(c -> c.getId().equals(link.getCheckInId()));
            if (stillAlive) {
                counts.merge(link.getTagId(), 1, Integer::sum);
            }
        }
        return counts;
    }
}

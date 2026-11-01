package com.nietu.daka.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nietu.daka.entity.CheckInTag;
import org.apache.ibatis.annotations.Mapper;

/**
 * 打卡与标签关系 Mapper。
 */
@Mapper
public interface CheckInTagMapper extends BaseMapper<CheckInTag> {
}

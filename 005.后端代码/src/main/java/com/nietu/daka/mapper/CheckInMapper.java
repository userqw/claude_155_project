package com.nietu.daka.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nietu.daka.entity.CheckIn;
import org.apache.ibatis.annotations.Mapper;

/**
 * 打卡记录 Mapper。
 */
@Mapper
public interface CheckInMapper extends BaseMapper<CheckIn> {
}

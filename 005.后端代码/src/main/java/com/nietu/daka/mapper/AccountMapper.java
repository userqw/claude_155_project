package com.nietu.daka.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nietu.daka.entity.Account;
import org.apache.ibatis.annotations.Mapper;

/**
 * 账号 Mapper。
 */
@Mapper
public interface AccountMapper extends BaseMapper<Account> {
}

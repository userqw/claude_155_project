package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.LoginRequest;
import com.nietu.daka.dto.AccountView;
import com.nietu.daka.dto.LoginResponse;
import com.nietu.daka.dto.ProfileRequest;
import com.nietu.daka.dto.WechatSession;
import com.nietu.daka.entity.Account;
import com.nietu.daka.entity.Shape;
import com.nietu.daka.entity.Tag;
import com.nietu.daka.mapper.AccountMapper;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.DeviceMapper;
import com.nietu.daka.mapper.ShapeMapper;
import com.nietu.daka.mapper.TagMapper;
import com.nietu.daka.mapper.SyncMapper;
import com.nietu.daka.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 登录与账号。
 *
 * <p>注册是隐式的：服务端第一次见到 openid 就建号，并按内置目录复制一份造型与标签。
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AccountMapper accountMapper;
    private final ShapeMapper shapeMapper;
    private final TagMapper tagMapper;
    private final CheckInMapper checkInMapper;
    private final DeviceMapper deviceMapper;
    private final SyncMapper syncMapper;
    private final JwtTokenProvider tokenProvider;
    private final WechatAuthService wechatAuthService;

    public AuthService(AccountMapper accountMapper, ShapeMapper shapeMapper, TagMapper tagMapper,
                       CheckInMapper checkInMapper, DeviceMapper deviceMapper, SyncMapper syncMapper,
                       JwtTokenProvider tokenProvider, WechatAuthService wechatAuthService) {
        this.accountMapper = accountMapper;
        this.shapeMapper = shapeMapper;
        this.tagMapper = tagMapper;
        this.checkInMapper = checkInMapper;
        this.deviceMapper = deviceMapper;
        this.syncMapper = syncMapper;
        this.tokenProvider = tokenProvider;
        this.wechatAuthService = wechatAuthService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        if (request.code() == null || request.code().isBlank()) {
            throw new BizException("缺少 wx.login 的 code");
        }
        WechatSession session = wechatAuthService.exchange(request.code());
        String openid = session.openid();

        Account account = accountMapper.selectById(openid);
        boolean newUser = account == null;
        LocalDateTime now = LocalDateTime.now();

        if (newUser) {
            account = new Account();
            account.setOpenid(openid);
            account.setDataScope("cloud");
            account.setCreatedAt(now);
            account.setLastLoginAt(now);
            account.setNickname(request.nickname());
            account.setAvatarUrl(request.avatarUrl());
            account.setUnionid(session.unionid());
            accountMapper.insert(account);
            seedBuiltins(openid, now);
        } else {
            account.setLastLoginAt(now);
            if (request.nickname() != null && !request.nickname().isBlank()) {
                account.setNickname(request.nickname());
            }
            if (request.avatarUrl() != null && !request.avatarUrl().isBlank()) {
                account.setAvatarUrl(request.avatarUrl());
            }
            // unionid 后台才能给齐，补上但不覆盖已有的
            if (session.unionid() != null && !session.unionid().isBlank()) {
                account.setUnionid(session.unionid());
            }
            accountMapper.updateById(account);
        }

        String token = tokenProvider.createToken(openid);
        return new LoginResponse(token, toView(account), newUser, tokenProvider.getExpireSeconds(),
                wechatAuthService.isMockMode());
    }

    /** 账号实体 -> 给客户端的视图对象 */
    private AccountView toView(Account account) {
        return new AccountView(account.getOpenid(), account.getUnionid(),
                account.getNickname(), account.getAvatarUrl(), account.getCreatedAt());
    }

    /** 账号视图对象 */
    public AccountView profileView(String openid) {
        return toView(profile(openid));
    }

    /** 服务端是否还在 mock 模式（没配 appid/secret，openid 是假的） */
    public boolean isMockMode() {
        return wechatAuthService.isMockMode();
    }

    /** 新用户建号时复制一份内置造型与标签 */
    private void seedBuiltins(String openid, LocalDateTime now) {
        for (BuiltinCatalog.ShapeSeed seed : BuiltinCatalog.SHAPES) {
            Shape shape = new Shape();
            shape.setOpenid(openid);
            shape.setId(seed.id());
            shape.setName(seed.name());
            shape.setIcon(seed.icon());
            shape.setIconPath(seed.iconPath());
            shape.setColor(seed.color());
            shape.setSlot(seed.slot());
            shape.setSort(seed.sort());
            shape.setIsBuiltin(1);
            shape.setCreatedAt(now);
            shape.setUpdatedAt(now);
            shapeMapper.insert(shape);
        }
        for (BuiltinCatalog.TagSeed seed : BuiltinCatalog.TAGS) {
            Tag tag = new Tag();
            tag.setOpenid(openid);
            tag.setId(seed.id());
            tag.setName(seed.name());
            tag.setColor(seed.color());
            tag.setIsBuiltin(1);
            tag.setCreatedAt(now);
            tag.setUpdatedAt(now);
            tagMapper.insert(tag);
        }
    }

    public Account profile(String openid) {
        Account account = accountMapper.selectById(openid);
        if (account == null) {
            throw BizException.notFound("账号不存在");
        }
        return account;
    }

    public Account updateProfile(String openid, ProfileRequest request) {
        Account account = profile(openid);
        if (request.nickname() != null) {
            account.setNickname(request.nickname());
        }
        if (request.avatarUrl() != null) {
            account.setAvatarUrl(request.avatarUrl());
        }
        accountMapper.updateById(account);
        return account;
    }

    /** 注销账号：删掉这个 openid 名下的全部数据（合规要求：个人信息删除权） */
    @Transactional
    public void deleteAccount(String openid) {
        profile(openid);

        // 不能只删 account 行靠级联带走：check_in / material 到 shape、material_folder
        // 的外键是 RESTRICT（语义上不能级联删），RESTRICT 不参与级联，
        // 会先挡住删除。所以按依赖顺序显式删。
        // 1) 先解开素材的文件夹引用
        syncMapper.clearMaterialFolders(openid);
        // 2) 删打卡记录（照片、售出、标签关联都是 CASCADE，跟着一起走）
        checkInMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.nietu.daka.entity.CheckIn>()
                .eq(com.nietu.daka.entity.CheckIn::getOpenid, openid));
        // 3) 删造型、标签、设备
        shapeMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.nietu.daka.entity.Shape>()
                .eq(com.nietu.daka.entity.Shape::getOpenid, openid));
        tagMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.nietu.daka.entity.Tag>()
                .eq(com.nietu.daka.entity.Tag::getOpenid, openid));
        deviceMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.nietu.daka.entity.Device>()
                .eq(com.nietu.daka.entity.Device::getOpenid, openid));
        // 4) 最后删账号
        accountMapper.deleteById(openid);
        log.info("账号已注销: {}", openid);
    }

    /** 账号列表（给运营/后台用） */
    public java.util.List<Account> listAccounts(int limit) {
        return accountMapper.selectList(Wrappers.<Account>lambdaQuery().last("LIMIT " + limit));
    }
}

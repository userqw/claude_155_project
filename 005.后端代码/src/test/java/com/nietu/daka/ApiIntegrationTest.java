package com.nietu.daka;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.dto.CheckInDto;
import com.nietu.daka.dto.LoginRequest;
import com.nietu.daka.dto.LoginResponse;
import com.nietu.daka.dto.PhotoDto;
import com.nietu.daka.dto.SaleDto;
import com.nietu.daka.dto.SyncPullResponse;
import com.nietu.daka.dto.SyncPushRequest;
import com.nietu.daka.entity.Account;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.mapper.AccountMapper;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.service.AuthService;
import com.nietu.daka.service.CheckInService;
import com.nietu.daka.service.SyncService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 集成测试：跑在真实 MySQL 上（dev profile）。
 *
 * <p>覆盖三件容易出错的事：注册建号与内置分类下发、同步的字段级合并语义、
 * 以及复合主键下的跨账号数据隔离。
 */
@SpringBootTest
@ActiveProfiles({"dev", "local"})
class ApiIntegrationTest {

    @Autowired
    private AuthService authService;
    @Autowired
    private CheckInService checkInService;
    @Autowired
    private SyncService syncService;
    @Autowired
    private AccountMapper accountMapper;
    @Autowired
    private CheckInMapper checkInMapper;

    private String openid;

    @AfterEach
    void cleanup() {
        if (openid != null) {
            accountMapper.deleteById(openid);
            openid = null;
        }
    }

    private LoginResponse login(String code) {
        LoginResponse response = authService.login(new LoginRequest(code, "测试用户", null));
        // PRD 5.6.2: login returns { token, account: { openid, ... } }
        openid = response.account().openid();
        return response;
    }

    /** 构造一条打卡记录，省得每次都数 DTO 的组件个数 */
    private CheckInDto checkIn(String id, LocalDate date, String shapeId, int count,
                               String note, LocalDateTime updatedAt) {
        return new CheckInDto(id, date, shapeId, count, note, 30, null,
                List.of(), List.of(), List.of(), false, updatedAt, null);
    }

    private SyncPushRequest push(String deviceId, List<CheckInDto> checkIns, List<SaleDto> sales) {
        return new SyncPushRequest(deviceId, checkIns, sales, List.of(), List.of(), List.of(),
                List.of(), List.of());
    }

    @Test
    @DisplayName("首次登录自动建号，并下发 4 个内置造型、6 个内置标签")
    void firstLoginSeedsBuiltins() {
        LoginResponse response = login("it_" + UUID.randomUUID());
        assertThat(response.token()).isNotBlank();
        assertThat(response.newUser()).isTrue();
        assertThat(response.account().openid()).isNotBlank();

        SyncPullResponse pull = syncService.pull(response.account().openid(), LocalDateTime.of(1970, 1, 1, 0, 0));
        assertThat(pull.shapes()).hasSize(4);
        assertThat(pull.tags()).hasSize(6);
        assertThat(pull.shapes().get(0).name()).isEqualTo("OB11娃头");
        assertThat(pull.shapes().get(0).iconPath()).isEqualTo("/assets/icons/ob11.svg");
    }

    @Test
    @DisplayName("同步：updated_at 更旧的版本不覆盖更新的数据")
    void olderUpdateDoesNotOverwrite() {
        LoginResponse response = login("it_" + UUID.randomUUID());
        String id = "ci_it_" + UUID.randomUUID();

        syncService.push(response.account().openid(), push("dev_it",
                List.of(checkIn(id, LocalDate.of(2026, 3, 10), "shape_qq", 3, "第一版",
                        LocalDateTime.of(2026, 3, 10, 10, 0))),
                List.of()));

        syncService.push(response.account().openid(), push("dev_it",
                List.of(checkIn(id, LocalDate.of(2026, 3, 10), "shape_qq", 99, "旧版本",
                        LocalDateTime.of(2026, 3, 10, 9, 0))),
                List.of()));

        CheckIn row = checkInMapper.selectOne(
                new LambdaQueryWrapper<CheckIn>()
                        .eq(CheckIn::getOpenid, response.account().openid())
                        .eq(CheckIn::getId, id));
        assertThat(row).isNotNull();
        assertThat(row.getCount()).isEqualTo(3);
        assertThat(row.getNote()).isEqualTo("第一版");
    }

    @Test
    @DisplayName("软删除后能真正恢复（deleted_at 要被清成 NULL）")
    void restoreClearsDeletedAt() {
        LoginResponse response = login("it_" + UUID.randomUUID());
        String id = "ci_it_" + UUID.randomUUID();

        checkInService.create(response.account().openid(),
                checkIn(id, LocalDate.of(2026, 4, 1), "shape_qq", 2, "",
                        LocalDateTime.of(2026, 4, 1, 10, 0)));

        checkInService.delete(response.account().openid(), id);
        assertThat(checkInService.list(response.account().openid(), 2026, null, 1, 20).getRecords())
                .noneMatch(r -> r.getId().equals(id));

        checkInService.restore(response.account().openid(), id);
        assertThat(checkInService.list(response.account().openid(), 2026, null, 1, 20).getRecords())
                .anyMatch(r -> r.getId().equals(id));
    }

    @Test
    @DisplayName("复合主键：别的账号改不了我的记录")
    void otherAccountCannotTouchMyRecord() {
        LoginResponse owner = login("it_owner_" + UUID.randomUUID());
        String ownerOpenid = owner.account().openid();
        LoginResponse other = login("it_other_" + UUID.randomUUID());
        String id = "ci_it_" + UUID.randomUUID();

        checkInService.create(ownerOpenid,
                checkIn(id, LocalDate.of(2026, 5, 5), "shape_qq", 4, "",
                        LocalDateTime.of(2026, 5, 5, 10, 0)));

        // 另一个账号用同一个 id 改 —— 必须找不到、不能覆盖
        assertThatThrownBy(() -> checkInService.update(other.account().openid(), id,
                checkIn(id, LocalDate.of(2026, 5, 5), "shape_qq", 666, "", LocalDateTime.now())))
                .isNotNull();

        CheckIn row = checkInMapper.selectOne(
                new LambdaQueryWrapper<CheckIn>()
                        .eq(CheckIn::getOpenid, ownerOpenid)
                        .eq(CheckIn::getId, id));
        assertThat(row.getCount()).isEqualTo(4);

        accountMapper.deleteById(other.account().openid());
    }

    @Test
    @DisplayName("售出记录是追加型：重复推送幂等且不改金额")
    void salePushIsIdempotent() {
        LoginResponse response = login("it_" + UUID.randomUUID());
        String checkInId = "ci_it_" + UUID.randomUUID();
        String saleId = "sale_it_" + UUID.randomUUID();

        checkInService.create(response.account().openid(),
                checkIn(checkInId, LocalDate.of(2026, 6, 6), "shape_qq", 5, "",
                        LocalDateTime.of(2026, 6, 6, 10, 0)));

        SaleDto sale = new SaleDto(saleId, checkInId, 2, new BigDecimal("35.50"),
                LocalDate.of(2026, 7, 1), "xhs", "", LocalDateTime.of(2026, 7, 1, 10, 0));
        syncService.push(response.account().openid(), push("dev_it", List.of(), List.of(sale)));

        SaleDto tampered = new SaleDto(saleId, checkInId, 9, new BigDecimal("99"),
                LocalDate.of(2026, 7, 1), "xhs", "", LocalDateTime.of(2026, 7, 1, 11, 0));
        syncService.push(response.account().openid(), push("dev_it", List.of(), List.of(tampered)));

        List<SaleDto> sales = syncService.pull(response.account().openid(),
                LocalDateTime.of(1970, 1, 1, 0, 0)).sales();
        assertThat(sales).hasSize(1);
        assertThat(sales.get(0).quantity()).isEqualTo(2);
        assertThat(sales.get(0).unitPrice()).isEqualByComparingTo("35.50");
    }

    @Test
    @DisplayName("注销账号：该账号的数据全部清掉")
    void deleteAccountRemovesEverything() {
        LoginResponse response = login("it_" + UUID.randomUUID());
        String id = "ci_it_" + UUID.randomUUID();
        checkInService.create(response.account().openid(),
                checkIn(id, LocalDate.of(2026, 7, 8), "shape_qq", 1, "",
                        LocalDateTime.of(2026, 7, 8, 10, 0)));

        authService.deleteAccount(response.account().openid());
        openid = null;

        assertThat(accountMapper.selectById(response.account().openid())).isNull();
        assertThat(checkInMapper.selectCount(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, response.account().openid()))).isZero();
    }
}

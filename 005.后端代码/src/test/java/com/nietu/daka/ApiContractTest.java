package com.nietu.daka;

import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.CheckInRequest;
import com.nietu.daka.dto.FolderDto;
import com.nietu.daka.dto.MaterialDto;
import com.nietu.daka.dto.ReorderRequest;
import com.nietu.daka.dto.SaleRequest;
import com.nietu.daka.dto.ShapeRequest;
import com.nietu.daka.dto.ShapeVo;
import com.nietu.daka.dto.TagRequest;
import com.nietu.daka.dto.TagVo;
import com.nietu.daka.dto.TrashVo;
import com.nietu.daka.dto.YearCompareRow;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Material;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.MaterialMapper;
import com.nietu.daka.service.AuthService;
import com.nietu.daka.service.CheckInService;
import com.nietu.daka.service.MaterialService;
import com.nietu.daka.service.SaleService;
import com.nietu.daka.service.ShapeService;
import com.nietu.daka.service.StatsService;
import com.nietu.daka.service.TagService;
import com.nietu.daka.service.TrashService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 接口契约的集成测试（跑真实 MySQL）。
 *
 * <p>覆盖新增的品类 / 标签 / 售出 / 回收站 / 统计对比，
 * 以及素材的修改与改名——这些都是前端要直接对接的接口。
 *
 * <p>微信相关配置显式钉死，测试结果不取决于这台机器配没配 AppID（规范 TEST-02）。
 */
@SpringBootTest(properties = {
        "app.wechat.app-id=",
        "app.wechat.secret=",
        "app.wechat.app-id-file=target/no-such-project.config.json",
        "app.wechat.mock=true",
        "app.wechat.require-credentials=false"
})
@ActiveProfiles({"dev", "local"})
class ApiContractTest {

    @Autowired
    private AuthService authService;
    @Autowired
    private CheckInService checkInService;
    @Autowired
    private ShapeService shapeService;
    @Autowired
    private TagService tagService;
    @Autowired
    private SaleService saleService;
    @Autowired
    private TrashService trashService;
    @Autowired
    private StatsService statsService;
    @Autowired
    private MaterialService materialService;
    @Autowired
    private CheckInMapper checkInMapper;
    @Autowired
    private MaterialMapper materialMapper;
    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    private String openid;

    @AfterEach
    void cleanup() {
        if (openid != null) {
            authService.deleteAccount(openid);
            openid = null;
        }
    }

    private String login() {
        var response = authService.login(new com.nietu.daka.dto.LoginRequest(
                "ct_" + java.util.UUID.randomUUID(), "契约测试", null));
        openid = response.account().openid();
        return openid;
    }

    // -- 契约 ---------------------------------------------------------------

    @Test
    @DisplayName("契约：时间戳带 Z，且能读回带 Z 的入参")
    void timestampsCarryUtcMarker() throws Exception {
        var mapper = objectMapper;
        String json = mapper.writeValueAsString(
                java.util.Map.of("at", java.time.LocalDateTime.of(2026, 3, 10, 10, 15, 30)));
        assertThat(json).as("出参必须带 UTC 标记，否则 JS 端会按本地时间解析，差 8 小时")
                .contains("2026-03-10T10:15:30.000Z");

        // 入参对称：小程序同步上传的就是带 Z 的 ISO-8601
        java.time.LocalDateTime back = mapper.readValue(
                "\"2026-03-10T10:15:30.000Z\"", java.time.LocalDateTime.class);
        assertThat(back).isEqualTo(java.time.LocalDateTime.of(2026, 3, 10, 10, 15, 30));
    }

    // -- 品类 ---------------------------------------------------------------

    @Test
    @DisplayName("品类：自定义品类用扩展色槽，最多 4 个，内置的不能删")
    void shapeCrud() {
        String uid = login();

        // 内置四个都在
        List<ShapeVo> builtins = shapeService.list(uid).stream().filter(ShapeVo::builtin).toList();
        assertThat(builtins).hasSize(4);

        // 新建自定义品类 → 用扩展色槽 4~7
        ShapeVo created = shapeService.create(uid, new ShapeRequest("摆件", "🎁", "", "", null));
        assertThat(created.slot()).isBetween(4, 7);
        assertThat(created.builtin()).isFalse();
        assertThat(created.used()).isZero();

        // 用到 4 个之后再建 → 拒绝，不复用色槽
        shapeService.create(uid, new ShapeRequest("摆件2", "🎁", "", "", null));
        shapeService.create(uid, new ShapeRequest("摆件3", "🎁", "", "", null));
        shapeService.create(uid, new ShapeRequest("摆件4", "🎁", "", "", null));
        assertThatThrownBy(() -> shapeService.create(uid,
                new ShapeRequest("摆件5", "🎁", "", "", null)))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("最多 4 个");

        // 内置的不能删
        assertThatThrownBy(() -> shapeService.delete(uid, "shape_ob11"))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("不能删除");
    }

    @Test
    @DisplayName("品类：删除自定义品类时，历史记录迁到「其他」")
    void deletingShapeMigratesRecords() {
        String uid = login();
        ShapeVo shape = shapeService.create(uid, new ShapeRequest("摆件", "🎁", "", "", null));
        var created = checkInService.create(uid, new CheckInRequest(null, LocalDate.of(2026, 6, 1),
                shape.id(), 3, "用了这个品类", null, null, List.of(), List.of()).toDto());

        shapeService.delete(uid, shape.id());

        // 记录本身还在，只是品类被改成了「其他」
        CheckIn moved = checkInMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CheckIn>()
                        .eq(CheckIn::getOpenid, uid)
                        .eq(CheckIn::getId, created.id())
                        .last("LIMIT 1"));
        assertThat(moved).as("记录不该被删").isNotNull();
        assertThat(moved.getShapeId()).isEqualTo("shape_other");
        assertThat(moved.getCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("品类：内置的可改名，但颜色与色槽改不了")
    void builtinShapeIsRenameableOnly() {
        String uid = login();
        ShapeVo renamed = shapeService.update(uid, "shape_qq",
                new ShapeRequest("QQ头", "🙂", "", "#000000", null));
        assertThat(renamed.name()).isEqualTo("QQ头");
        assertThat(renamed.slot()).as("内置品类的色槽是固定的").isEqualTo(1);
        assertThat(renamed.color()).as("内置品类的颜色是固定的").isNotEqualTo("#000000");
    }

    @Test
    @DisplayName("品类：按给定顺序重排")
    void shapeReorder() {
        String uid = login();
        List<String> ids = shapeService.list(uid).stream().map(ShapeVo::id).toList();
        List<String> reversed = new java.util.ArrayList<>(ids);
        java.util.Collections.reverse(reversed);

        shapeService.reorder(uid, reversed);

        assertThat(shapeService.list(uid).stream().map(ShapeVo::id).toList())
                .containsExactlyElementsOf(reversed);
    }

    // -- 标签 ---------------------------------------------------------------

    @Test
    @DisplayName("标签：可增删改，内置的不能删")
    void tagCrud() {
        String uid = login();
        TagVo created = tagService.create(uid, new TagRequest("急单", "#E87BA4"));
        assertThat(created.builtin()).isFalse();

        TagVo updated = tagService.update(uid, created.id(), new TagRequest("加急", "#E34948"));
        assertThat(updated.name()).isEqualTo("加急");

        tagService.delete(uid, created.id());
        assertThat(tagService.list(uid)).noneMatch(t -> t.id().equals(created.id()));

        assertThatThrownBy(() -> tagService.delete(uid, "tag_limit"))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("不能删除");
    }

    // -- 售出 ---------------------------------------------------------------

    @Test
    @DisplayName("售出：数量不能超过未售出数量，总额由服务端算")
    void saleQuantityIsCapped() {
        String uid = login();
        var checkIn = checkInService.create(uid, new CheckInRequest(null, LocalDate.of(2026, 6, 1),
                "shape_qq", 3, "", null, null, List.of(), List.of()).toDto());

        var sale = saleService.create(uid, new SaleRequest(checkIn.id(), 2, new BigDecimal("35.50"),
                LocalDate.of(2026, 7, 1), "xhs", ""));
        assertThat(sale.totalAmount()).isEqualByComparingTo("71.00");
        assertThat(saleService.soldQuantity(uid, checkIn.id())).isEqualTo(2);

        // 只剩 1 个了，卖 2 个不行
        assertThatThrownBy(() -> saleService.create(uid, new SaleRequest(checkIn.id(), 2,
                new BigDecimal("35.50"), LocalDate.of(2026, 7, 1), "xhs", "")))
                .isInstanceOf(BizException.class)
                .hasMessageContaining("未售出数量");

        // 卖 1 个可以
        assertThat(saleService.create(uid, new SaleRequest(checkIn.id(), 1,
                new BigDecimal("10"), LocalDate.of(2026, 7, 2), "xhs", "")).quantity()).isEqualTo(1);
    }

    @Test
    @DisplayName("售出：撤单后数量释放出来")
    void saleDeleteFreesQuantity() {
        String uid = login();
        var checkIn = checkInService.create(uid, new CheckInRequest(null, LocalDate.of(2026, 6, 1),
                "shape_qq", 2, "", null, null, List.of(), List.of()).toDto());
        var sale = saleService.create(uid, new SaleRequest(checkIn.id(), 2,
                new BigDecimal("20"), LocalDate.of(2026, 7, 1), "xhs", ""));

        saleService.delete(uid, sale.id());

        assertThat(saleService.soldQuantity(uid, checkIn.id())).isZero();
        assertThat(saleService.list(uid, checkIn.id())).isEmpty();
    }

    // -- 回收站 -------------------------------------------------------------

    @Test
    @DisplayName("回收站：软删除的记录在列表里，彻底删除后消失")
    void trashLifecycle() {
        String uid = login();
        var checkIn = checkInService.create(uid, new CheckInRequest(null, LocalDate.of(2026, 6, 1),
                "shape_qq", 2, "", null, null, List.of(), List.of()).toDto());
        checkInService.delete(uid, checkIn.id());

        List<TrashVo> items = trashService.list(uid);
        assertThat(items).extracting(TrashVo::entityType).contains("check_in");
        TrashVo item = items.stream().filter(t -> t.id().equals(checkIn.id())).findFirst().orElseThrow();
        assertThat(item.daysAgo()).isNotNegative();

        trashService.purge(uid, "check_in", checkIn.id());
        assertThat(trashService.list(uid)).noneMatch(t -> t.id().equals(checkIn.id()));
    }

    // -- 统计 ---------------------------------------------------------------

    @Test
    @DisplayName("统计：没有数据的年份返回全 0，不是 404")
    void emptyYearReturnsZeros() {
        String uid = login();
        var overview = statsService.overview(uid, 1999);
        assertThat(overview.production()).isZero();
        assertThat(overview.revenue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("统计：跨年对比，上一年没记录时不给百分比")
    void yearCompare() {
        String uid = login();
        checkInService.create(uid, new CheckInRequest(null, LocalDate.of(2026, 6, 1),
                "shape_qq", 10, "", null, null, List.of(), List.of()).toDto());

        YearCompareRow compare = statsService.compare(uid, 2026);
        assertThat(compare.current()).isEqualTo(10);
        assertThat(compare.previous()).isZero();
        assertThat(compare.hasPrevious()).isFalse();
        assertThat(compare.rate()).isNull();
    }

    // -- 素材 ---------------------------------------------------------------

    @Test
    @DisplayName("素材：可改名称备注与所属文件夹；删文件夹素材转未分类")
    void materialUpdateAndFolderDelete() {
        String uid = login();
        var folder = materialService.createFolder(uid, new FolderDto(null, "配色参考", 0, null, null));
        var material = materialService.saveMaterial(uid,
                new MaterialDto(null, folder.id(), "https://x/a.jpg", "", "暖橘", "", null));

        var updated = materialService.updateMaterial(uid, material.id(),
                new MaterialDto(material.id(), "", "https://x/a.jpg", "", "改名了", "备注也改了", null));
        assertThat(updated.name()).isEqualTo("改名了");

        Material row = materialMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Material>()
                        .eq(Material::getOpenid, uid)
                        .eq(Material::getId, material.id())
                        .last("LIMIT 1"));
        assertThat(row).isNotNull();
        assertThat(row.getName()).isEqualTo("改名了");
        assertThat(row.getNote()).isEqualTo("备注也改了");

        // 删文件夹不删素材
        materialService.deleteFolder(uid, folder.id());
        Material after = materialMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Material>()
                        .eq(Material::getOpenid, uid)
                        .eq(Material::getId, material.id())
                        .last("LIMIT 1"));
        assertThat(after).as("素材不该被删").isNotNull();
        assertThat(after.getFolderId()).as("素材该转到未分类").isNull();
    }

    @Test
    @DisplayName("素材：文件夹改名")
    void renameFolder() {
        String uid = login();
        var folder = materialService.createFolder(uid, new FolderDto(null, "旧名字", 0, null, null));
        var renamed = materialService.renameFolder(uid, folder.id(), "新名字");
        assertThat(renamed.name()).isEqualTo("新名字");
    }
}

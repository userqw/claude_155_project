package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.common.BizException;
import com.nietu.daka.dto.SaleRequest;
import com.nietu.daka.dto.SaleVo;
import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Sale;
import com.nietu.daka.mapper.CheckInMapper;
import com.nietu.daka.mapper.SaleMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 售出记录。
 *
 * <p>两条硬规则：
 * <ul>
 *   <li><b>追加型，只增不改</b>（PRD §6.3）：售出金额已经被算进营收报表，
 *       改写历史会让过去的报表失真。要撤就删掉再记一条。</li>
 *   <li><b>数量不能超过未售出数量</b>（PRD §6.3 / 领域规则 3）：
 *       这条必须在服务端兜住——只靠表单限制的话，换个客户端就能把库存做成负数。</li>
 * </ul>
 */
@Service
public class SaleService {

    private final SaleMapper saleMapper;
    private final CheckInMapper checkInMapper;

    public SaleService(SaleMapper saleMapper, CheckInMapper checkInMapper) {
        this.saleMapper = saleMapper;
        this.checkInMapper = checkInMapper;
    }

    /** 列出售出记录；给了 checkInId 就只看那一条记录下的 */
    public List<SaleVo> list(String openid, String checkInId) {
        LambdaQueryWrapper<Sale> query = new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .isNull(Sale::getDeletedAt);
        if (checkInId != null && !checkInId.isBlank()) {
            query.eq(Sale::getCheckInId, checkInId);
        }
        query.orderByDesc(Sale::getSoldDate).orderByDesc(Sale::getCreatedAt);
        return saleMapper.selectList(query).stream().map(SaleVo::of).toList();
    }

    /**
     * 新增售出记录。
     *
     * <p>金额由服务端算：{@code totalAmount = unitPrice × quantity}，
     * 不采信客户端传来的总额（那是可被篡改的）。
     */
    @Transactional
    public SaleVo create(String openid, SaleRequest request) {
        CheckIn checkIn = requireCheckIn(openid, request.checkInId());

        int sold = soldQuantity(openid, request.checkInId());
        int made = checkIn.getCount() == null ? 0 : checkIn.getCount();
        int unsold = made - sold;
        if (request.quantity() > unsold) {
            throw new BizException(400,
                    "不能超过未售出数量（这条记录还剩 " + Math.max(0, unsold) + " 个）");
        }
        if (request.soldDate() != null && request.soldDate().isAfter(LocalDate.now())) {
            throw new BizException(400, "不能记录未来的售出日期");
        }

        LocalDateTime now = LocalDateTime.now();
        Sale sale = new Sale();
        sale.setOpenid(openid);
        sale.setId("sale_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        sale.setCheckInId(request.checkInId());
        sale.setQuantity(request.quantity());
        sale.setUnitPrice(request.unitPrice());
        sale.setTotalAmount(request.unitPrice().multiply(BigDecimal.valueOf(request.quantity())));
        sale.setSoldDate(request.soldDate());
        sale.setChannel(request.channel() == null || request.channel().isBlank() ? "other" : request.channel());
        sale.setNote(request.note() == null ? "" : request.note());
        sale.setCreatedAt(now);
        sale.setUpdatedAt(now);
        saleMapper.insert(sale);
        return SaleVo.of(sale);
    }

    /** 删除一条售出记录（撤单）。软删除，保留痕迹 */
    @Transactional
    public void delete(String openid, String id) {
        Sale sale = requireSale(openid, id);
        sale.setDeletedAt(LocalDateTime.now());
        sale.setUpdatedAt(sale.getDeletedAt());
        saleMapper.update(sale, new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .eq(Sale::getId, id));
    }

    /** 某条记录已经卖出的总数 */
    public int soldQuantity(String openid, String checkInId) {
        int total = 0;
        for (Sale sale : saleMapper.selectList(new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .eq(Sale::getCheckInId, checkInId)
                .isNull(Sale::getDeletedAt))) {
            total += sale.getQuantity() == null ? 0 : sale.getQuantity();
        }
        return total;
    }

    private CheckIn requireCheckIn(String openid, String checkInId) {
        CheckIn row = checkInMapper.selectOne(new LambdaQueryWrapper<CheckIn>()
                .eq(CheckIn::getOpenid, openid)
                .eq(CheckIn::getId, checkInId)
                .isNull(CheckIn::getDeletedAt)
                .last("LIMIT 1"));
        if (row == null) {
            throw BizException.notFound("记录不存在");
        }
        return row;
    }

    private Sale requireSale(String openid, String id) {
        Sale sale = saleMapper.selectOne(new LambdaQueryWrapper<Sale>()
                .eq(Sale::getOpenid, openid)
                .eq(Sale::getId, id)
                .isNull(Sale::getDeletedAt)
                .last("LIMIT 1"));
        if (sale == null) {
            throw BizException.notFound("售出记录不存在");
        }
        return sale;
    }
}

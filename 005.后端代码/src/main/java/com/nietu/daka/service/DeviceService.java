package com.nietu.daka.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nietu.daka.entity.Device;
import com.nietu.daka.mapper.DeviceMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Device registry.
 *
 * <p>The client sends deviceId on check-in and sync, but the device row may be
 * seen for the first time - without registering it first, the
 * check_in.device_id foreign key rejects the write.
 * Register-on-use keeps the client from needing a separate call.
 */
@Service
public class DeviceService {

    private final DeviceMapper deviceMapper;

    public DeviceService(DeviceMapper deviceMapper) {
        this.deviceMapper = deviceMapper;
    }

    /** Make sure this device is registered; insert it if not. */
    public void ensure(String openid, String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return;
        }
        long exists = deviceMapper.selectCount(new LambdaQueryWrapper<Device>()
                .eq(Device::getOpenid, openid)
                .eq(Device::getId, deviceId));
        if (exists > 0) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        Device device = new Device();
        device.setOpenid(openid);
        device.setId(deviceId);
        device.setPushedCount(0);
        device.setCreatedAt(now);
        device.setUpdatedAt(now);
        deviceMapper.insert(device);
    }
}

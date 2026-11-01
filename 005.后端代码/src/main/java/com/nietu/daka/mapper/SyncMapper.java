package com.nietu.daka.mapper;

import com.nietu.daka.entity.CheckIn;
import com.nietu.daka.entity.Material;
import com.nietu.daka.entity.MaterialFolder;
import com.nietu.daka.entity.Photo;
import com.nietu.daka.entity.Sale;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 同步写入。
 *
 * <p>合并策略见 PRD §8.2：
 * <ul>
 *   <li>打卡 / 照片 / 文件夹 / 素材：按 updated_at 做字段级合并，后写覆盖先写；</li>
 *   <li>售出记录：追加型，只插入不改写（金额已被统计进报表，覆盖会改历史）；</li>
 *   <li>软删除用 deleted_at 做墓碑，删除动作本身也要同步，否则另一台设备会把记录「复活」。</li>
 * </ul>
 */
@Mapper
public interface SyncMapper {

    @Insert("""
            INSERT INTO `check_in`
              (`openid`,`id`,`date`,`shape_id`,`count`,`cover_photo_id`,`note`,`duration_min`,
               `device_id`,`created_at`,`updated_at`,`deleted_at`)
            VALUES
              (#{openid},#{id},#{date},#{shapeId},#{count},#{coverPhotoId},#{note},#{durationMin},
               #{deviceId},#{createdAt},#{updatedAt},#{deletedAt})
            ON DUPLICATE KEY UPDATE
              `date`           = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`date`),           `date`),
              `shape_id`       = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`shape_id`),       `shape_id`),
              `count`          = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`count`),          `count`),
              `cover_photo_id` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`cover_photo_id`), `cover_photo_id`),
              `note`           = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`note`),           `note`),
              `duration_min`   = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`duration_min`),   `duration_min`),
              `deleted_at`     = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`deleted_at`),     `deleted_at`),
              `device_id`      = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`device_id`),      `device_id`),
              `updated_at`     = GREATEST(`updated_at`, VALUES(`updated_at`))
            """)
    int upsertCheckIn(CheckIn row);

    @Insert("""
            INSERT INTO `photo`
              (`openid`,`id`,`check_in_id`,`url`,`local_path`,`width`,`height`,`sort`,
               `created_at`,`updated_at`,`deleted_at`)
            VALUES
              (#{openid},#{id},#{checkInId},#{url},#{localPath},#{width},#{height},#{sort},
               #{createdAt},#{updatedAt},#{deletedAt})
            ON DUPLICATE KEY UPDATE
              `url`        = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`url`),        `url`),
              `local_path` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`local_path`), `local_path`),
              `width`      = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`width`),      `width`),
              `height`     = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`height`),     `height`),
              `sort`       = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`sort`),       `sort`),
              `deleted_at` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`deleted_at`), `deleted_at`),
              `updated_at` = GREATEST(`updated_at`, VALUES(`updated_at`))
            """)
    int upsertPhoto(Photo row);

    @Insert("""
            INSERT INTO `material_folder`
              (`openid`,`id`,`name`,`cover_material_id`,`sort`,`created_at`,`updated_at`,`deleted_at`)
            VALUES
              (#{openid},#{id},#{name},#{coverMaterialId},#{sort},#{createdAt},#{updatedAt},#{deletedAt})
            ON DUPLICATE KEY UPDATE
              `name`              = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`name`),              `name`),
              `cover_material_id` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`cover_material_id`), `cover_material_id`),
              `sort`              = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`sort`),              `sort`),
              `deleted_at`        = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`deleted_at`),        `deleted_at`),
              `updated_at`        = GREATEST(`updated_at`, VALUES(`updated_at`))
            """)
    int upsertFolder(MaterialFolder row);

    @Insert("""
            INSERT INTO `material`
              (`openid`,`id`,`folder_id`,`url`,`local_path`,`name`,`note`,
               `created_at`,`updated_at`,`deleted_at`)
            VALUES
              (#{openid},#{id},#{folderId},#{url},#{localPath},#{name},#{note},
               #{createdAt},#{updatedAt},#{deletedAt})
            ON DUPLICATE KEY UPDATE
              `folder_id`  = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`folder_id`),  `folder_id`),
              `url`        = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`url`),        `url`),
              `local_path` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`local_path`), `local_path`),
              `name`       = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`name`),       `name`),
              `note`       = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`note`),       `note`),
              `deleted_at` = IF(VALUES(`updated_at`) > `updated_at`, VALUES(`deleted_at`), `deleted_at`),
              `updated_at` = GREATEST(`updated_at`, VALUES(`updated_at`))
            """)
    int upsertMaterial(Material row);

    /** 售出记录是追加型：同 id 重复推送幂等，且不改动已统计的金额 */
    @Insert("""
            INSERT IGNORE INTO `sale`
              (`openid`,`id`,`check_in_id`,`quantity`,`unit_price`,`total_amount`,
               `sold_date`,`channel`,`note`,`device_id`,`created_at`,`updated_at`,`deleted_at`)
            VALUES
              (#{openid},#{id},#{checkInId},#{quantity},#{unitPrice},#{totalAmount},
               #{soldDate},#{channel},#{note},#{deviceId},#{createdAt},#{updatedAt},#{deletedAt})
            """)
    int insertSaleIgnore(Sale row);

    /** 关联关系表：先清后插，保证幂等 */
    @org.apache.ibatis.annotations.Delete("DELETE FROM `check_in_tag` WHERE `openid` = #{openid} AND `check_in_id` = #{checkInId}")
    int deleteCheckInTags(@Param("openid") String openid, @Param("checkInId") String checkInId);

    @Insert("INSERT IGNORE INTO `check_in_tag` (`openid`,`check_in_id`,`tag_id`,`created_at`) "
            + "VALUES (#{openid},#{checkInId},#{tagId},#{createdAt})")
    int insertCheckInTag(@Param("openid") String openid,
                         @Param("checkInId") String checkInId,
                         @Param("tagId") String tagId,
                         @Param("createdAt") java.time.LocalDateTime createdAt);

    /** 删除文件夹但不删素材：素材转未分类（PRD §5.7） */
    @org.apache.ibatis.annotations.Update("UPDATE `material` SET `folder_id` = NULL WHERE `openid` = #{openid} AND `folder_id` = #{folderId}")
    int moveMaterialsToUnfiled(@Param("openid") String openid, @Param("folderId") String folderId);

    /**
     * 把某个账号名下所有素材的文件夹引用清空。
     *
     * <p>注销账号时要删掉 material_folder，但 material.folder_id 是 RESTRICT 外键，
     * 不先解开引用就删不掉文件夹——RESTRICT 不参与级联。
     */
    @org.apache.ibatis.annotations.Update("UPDATE `material` SET `folder_id` = NULL WHERE `openid` = #{openid}")
    int clearMaterialFolders(@Param("openid") String openid);
}

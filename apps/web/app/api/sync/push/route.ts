import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { withRoute } from "@/lib/api/with-route";
import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  applyChanges,
  recordSyncChanges,
  upsertSyncDevice,
  sanitizeDeviceId,
  sanitizeDeviceName,
  type SyncChange,
} from "@/lib/sync-service";

// 单批变更条数上限：超限让客户端分批推送，避免单事务过长持锁
const MAX_CHANGES = 500;

/**
 * 增量同步 Push（§37-§40）：客户端只发送自上次同步以来的本地变更（LWW）。
 *
 * S2-2：迁移到 withRoute —— 登录鉴权/限流（10 次/分钟）/2MB 流式体积上限/统一错误 envelope
 * 由入口统一处理；业务函数只关心 changes。
 */
export const POST = withRoute<Record<string, unknown>>(
  {
    auth: "user",
    bodyLimit: 2_000_000,
    limit: { key: "sync:push", n: 10, windowMs: 60_000 },
  },
  async ({ uid, rawBody }) => {
    const data = (rawBody ?? {}) as Record<string, unknown>;
    const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
    if (changes.length > MAX_CHANGES) {
      return apiError(413, `单批变更过多（>${MAX_CHANGES}），请分批推送`, {
        code: API_ERROR_CODES.validation_failed,
      });
    }
    const ownerId = uid as string;
    const rawDeviceId = String(data.deviceId || "unknown");
    // P0：deviceId 白名单校验，防止伪造标识刷 sync_devices
    const deviceId = sanitizeDeviceId(rawDeviceId, `anon-${ownerId.slice(0, 8)}`);
    const deviceName = sanitizeDeviceName(typeof data.deviceName === "string" ? data.deviceName : null);

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const { applied, okChanges } = await applyChanges(client, ownerId, changes);
      // P1：只把成功应用的变更写入幂等表——失败变更若也记 changeId，客户端重试会被
      // 当作"已应用"跳过，造成静默丢数据
      await recordSyncChanges(client, ownerId, deviceId, okChanges);
      await upsertSyncDevice(client, ownerId, deviceId, deviceName);
      await client.query("COMMIT");
      const { rows } = await client.query("SELECT now() AS now");
      return NextResponse.json({ ok: true, applied, serverTime: rows[0].now });
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error("sync push error", e);
      return apiError(500, "同步失败", { code: API_ERROR_CODES.internal_error });
    } finally {
      client.release();
    }
  }
);

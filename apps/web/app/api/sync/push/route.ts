import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { withRoute } from "@/lib/api/with-route";
import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  SYNC_ENTITY_TYPES,
  SYNC_MAX_CHANGES,
  syncChangeSchema,
  syncPushEnvelopeSchema,
  type SyncPushReceipt,
} from "@learn-workbench/shared/sync";
import {
  applyChanges,
  recordSyncChanges,
  upsertSyncDevice,
  sanitizeDeviceId,
  sanitizeDeviceName,
  serverTimeISO,
  type SyncChange,
} from "@/lib/sync-service";

/** 单批变更条数上限：超限让客户端分批推送，避免单事务过长持锁 */
const MAX_CHANGES = SYNC_MAX_CHANGES;

const KNOWN_ENTITY_TYPES = new Set<string>(SYNC_ENTITY_TYPES);

/**
 * 增量同步 Push v2（S5-2）：客户端只发送自上次同步以来的本地变更（LWW + seq 平局裁决）。
 *
 * 与 v1 的差异：
 *  1. 契约来自 `@learn-workbench/shared/sync`（zod），**手动逐条解析**而不是 withRoute.schema：
 *     这样才能把非法变更定位到"第几条"（400 + index），而不是一句笼统的 400；
 *  2. 响应增加 `receipts`：每条 { changeId, index, result: applied|stale|rejected, reason, seq }；
 *  3. 白名单外的 entityType 不整批 400，而是按条 rejected（服务端版本落后时向前兼容）；
 *  4. serverTime 统一为 Asia/Shanghai ISO（客户端唯一可信游标）。
 *
 * S2-2 保留：登录鉴权 / 限流（10 次/分钟）/ 2MB 流式体积上限 / 统一错误 envelope 由 withRoute 处理。
 */
export const POST = withRoute<Record<string, unknown>>(
  {
    auth: "user",
    bodyLimit: 2_000_000,
    limit: { key: "sync:push", n: 10, windowMs: 60_000 },
  },
  async ({ uid, rawBody, requestId }) => {
    const envelope = syncPushEnvelopeSchema.safeParse(rawBody ?? {});
    if (!envelope.success) {
      return apiError(400, "请求体必须包含 changes 数组", {
        code: API_ERROR_CODES.validation_failed,
        requestId,
      });
    }
    const { changes: rawChanges } = envelope.data;
    if (rawChanges.length > MAX_CHANGES) {
      return apiError(413, `单批变更过多（>${MAX_CHANGES}），请分批推送`, {
        code: API_ERROR_CODES.validation_failed,
        requestId,
      });
    }

    /**
     * 逐条解析：保住请求下标（index），未知实体也保留占位项 ——
     * 这样 applyChanges 产出的 receipts 与请求 changes[] 一一对应。
     */
    const changes: SyncChange[] = [];
    for (const [index, raw] of rawChanges.entries()) {
      const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const rawChangeId = typeof record.changeId === "string" && record.changeId.length > 0 ? record.changeId : undefined;
      const rawEntityType = record.entityType;

      // 未知实体：不 400，交给 applyChanges 回 rejected(unknown_entity_type) —— 客户端可跳过并继续
      if (typeof rawEntityType !== "string" || !KNOWN_ENTITY_TYPES.has(rawEntityType)) {
        changes.push({
          entityType: (typeof rawEntityType === "string" ? rawEntityType : "unknown") as SyncChange["entityType"],
          entityId: typeof record.entityId === "string" ? record.entityId : "",
          operation: "UPDATE",
          version: 1,
          payload: null,
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
          changeId: rawChangeId,
        });
        continue;
      }

      const parsed = syncChangeSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path.join(".") || "change";
        return NextResponse.json(
          {
            error: `第 ${index + 1} 条变更不合法（${field}）：${issue?.message ?? "格式错误"}`,
            code: API_ERROR_CODES.validation_failed,
            index,
            requestId,
          },
          { status: 400 }
        );
      }
      changes.push({ ...(parsed.data as SyncChange), changeId: rawChangeId });
    }

    const ownerId = uid as string;
    const rawDeviceId = typeof envelope.data.deviceId === "string" ? envelope.data.deviceId : "unknown";
    // P0：deviceId 白名单校验，防止伪造标识刷 sync_devices
    const deviceId = sanitizeDeviceId(rawDeviceId, `anon-${ownerId.slice(0, 8)}`);
    const deviceName = sanitizeDeviceName(envelope.data.deviceName ?? null);

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const result = await applyChanges(client, ownerId, changes);
      // P1：只把成功应用的变更写入幂等表——失败变更若也记 changeId，客户端重试会被
      // 当作"已应用"跳过，造成静默丢数据
      const seqs = await recordSyncChanges(client, ownerId, deviceId, result.okChanges);
      // seq 回填（applied 才有 recordIndex；stale-duplicate 的 seq 已在 applyChanges 里取回）
      for (const receipt of result.receipts) {
        if (receipt.recordIndex !== null) receipt.seq = seqs[receipt.recordIndex] ?? null;
      }
      await upsertSyncDevice(client, ownerId, deviceId, deviceName);
      await client.query("COMMIT");

      const { rows } = await client.query("SELECT now() AS now");
      const receipts: SyncPushReceipt[] = result.receipts.map((receipt) => ({
        changeId: receipt.changeId,
        index: receipt.index,
        result: receipt.result,
        reason: receipt.reason,
        seq: receipt.seq,
      }));
      return NextResponse.json({
        ok: true,
        applied: result.applied,
        receipts,
        serverTime: serverTimeISO(rows[0]?.now),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error("sync push error", e);
      return apiError(500, "同步失败", { code: API_ERROR_CODES.internal_error, requestId });
    } finally {
      client.release();
    }
  }
);

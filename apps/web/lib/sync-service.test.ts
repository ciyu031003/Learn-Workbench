import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import {
  applyChanges,
  collectChangesSince,
  recordSyncChanges,
  upsertSyncDevice,
  SYNC_ENTITY_TYPES,
  type SyncChange,
} from "./sync-service";

const AT = "2026-08-13T10:00:00.000Z";
const EARLIER = "2026-08-13T09:00:00.000Z";
const LATER = "2026-08-13T11:00:00.000Z";

function change(partial: Partial<SyncChange> & { entityType: string; entityId: string }): SyncChange {
  return {
    operation: "UPDATE",
    version: 1,
    payload: null,
    updatedAt: AT,
    ...partial,
  };
}

function makeClient(script: (sql: string, params: unknown[]) => { rows: unknown[] }) {
  const query = vi.fn((sql: string, params: unknown[]) => Promise.resolve(script(sql, params)));
  return { client: { query } as unknown as PoolClient, query };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SYNC_ENTITY_TYPES", () => {
  it("covers every applier and collection branch", () => {
    expect(SYNC_ENTITY_TYPES).toEqual([
      "progress",
      "tasks",
      "sessions",
      "checkins",
      "logs",
      "github",
      "customTopics",
    ]);
  });
});

describe("applyChanges", () => {
  it("skips unknown entity types", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "unknown", entityId: "x" }),
    ]);
    expect(applied).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("ignores progress with a non-numeric entity id", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "progress", entityId: "abc" }),
    ]);
    expect(applied).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects checkins with an invalid date entity id", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "checkins", entityId: "2026/08/13" }),
    ]);
    expect(applied).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("inserts new progress (UPDATE) with coerced payload", async () => {
    const { client, query } = makeClient((sql) =>
      sql.includes("SELECT updated_at, deleted_at FROM topic_progress") ? { rows: [] } : { rows: [] }
    );
    const applied = await applyChanges(client, "u-1", [
      change({
        entityType: "progress",
        entityId: "42",
        payload: { done: 1, note: "hello" },
      }),
    ]);
    expect(applied).toBe(1);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO topic_progress"));
    expect(insert).toBeDefined();
    expect(insert![1]).toEqual(["u-1", 42, true, "hello", new Date(AT)]);
  });

  it("does not overwrite newer local progress (LWW)", async () => {
    const { client, query } = makeClient((sql) =>
      sql.includes("SELECT updated_at, deleted_at FROM topic_progress")
        ? { rows: [{ updated_at: new Date(LATER), deleted_at: null }] }
        : { rows: [] }
    );
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "progress", entityId: "42", payload: { done: true, note: null } }),
    ]);
    expect(applied).toBe(1);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO topic_progress"))).toBe(false);
  });

  it("does not resurrect progress deleted later (LWW vs deleted_at)", async () => {
    const { client, query } = makeClient((sql) =>
      sql.includes("SELECT updated_at, deleted_at FROM topic_progress")
        ? { rows: [{ updated_at: new Date(EARLIER), deleted_at: new Date(LATER) }] }
        : { rows: [] }
    );
    await applyChanges(client, "u-1", [
      change({ entityType: "progress", entityId: "42", payload: { done: true } }),
    ]);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO topic_progress"))).toBe(false);
  });

  it("soft-deletes progress (DELETE)", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "progress", entityId: "7", operation: "DELETE" }),
    ]);
    expect(applied).toBe(1);
    const del = query.mock.calls.find(([sql]) => sql.includes("UPDATE topic_progress SET deleted_at"));
    expect(del).toBeDefined();
    expect(del![1]).toEqual(["u-1", 7, new Date(AT)]);
  });

  it("inserts tasks with defaulted fields", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({
        entityType: "tasks",
        entityId: "c-1",
        payload: { title: "T", done: 1, focusMinutes: "25", sortOrder: "3" },
      }),
    ]);
    expect(applied).toBe(1);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO daily_tasks"));
    expect(insert![1]).toEqual([
      "u-1", "c-1", null, "T", null, null, "study", true, 25, 3, new Date(AT),
    ]);
  });

  it("rejects tasks without a client id", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "tasks", entityId: "" }),
    ]);
    expect(applied).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("inserts sessions with startedAt fallback", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "sessions", entityId: "c-s1", payload: { durationSeconds: 1500 } }),
    ]);
    expect(applied).toBe(1);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO focus_sessions"));
    expect(insert![1]).toEqual([
      "u-1", "c-s1", null, new Date(AT), null, 1500, null, new Date(AT),
    ]);
  });

  it("inserts logs with string coercion", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await applyChanges(client, "u-1", [
      change({ entityType: "logs", entityId: "c-l1", payload: { kind: "feynman", title: 123, content: null } }),
    ]);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO log_entries"));
    expect(insert![1]).toEqual([
      "u-1", "c-l1", "feynman", "123", "", new Date(AT), new Date(AT),
    ]);
  });

  it("inserts github assets pinned to kind='github'", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await applyChanges(client, "u-1", [
      change({ entityType: "github", entityId: "c-g1", payload: { title: "GH", url: "https://x", content: "c" } }),
    ]);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO resume_assets"));
    expect(insert![1]).toEqual([
      "u-1", "c-g1", "GH", "https://x", "c", new Date(AT),
    ]);
    expect(insert![0]).toContain("'github'");
  });

  it("inserts customTopics with generated topic_key", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await applyChanges(client, "u-1", [
      change({
        entityType: "customTopics",
        entityId: "c-t1234567890ab",
        payload: { phaseId: "2", title: "CT", summary: null, sortOrder: "1" },
      }),
    ]);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO content_topics"));
    expect(insert![1]).toEqual([
      2, "custom-" + "c-t1234567890ab".slice(0, 12), "CT", null, 1, "u-1", "c-t1234567890ab", new Date(AT),
    ]);
  });

  it("continues after an applier throws and counts the others", async () => {
    let calls = 0;
    const query = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("boom"));
      return Promise.resolve({ rows: [] });
    });
    const client = { query } as unknown as PoolClient;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "progress", entityId: "1", payload: { done: true } }),
      change({ entityType: "progress", entityId: "2", payload: { done: true } }),
    ]);
    expect(applied).toBe(1);
    errSpy.mockRestore();
  });

  it("falls back to now() for an invalid updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    try {
      const { client, query } = makeClient(() => ({ rows: [] }));
      await applyChanges(client, "u-1", [
        change({ entityType: "progress", entityId: "9", updatedAt: "garbage", payload: { done: true } }),
      ]);
      const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO topic_progress"));
      expect(insert![1]).toEqual(["u-1", 9, true, null, new Date("2026-08-13T12:00:00.000Z")]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("collectChangesSince", () => {
  it("collects changes across all seven entity types", async () => {
    const script: Record<string, { rows: unknown[] }> = {
      "FROM topic_progress": {
        rows: [
          { id: 1, done: true, note: null, u: new Date(AT), d: null },
          { id: 2, done: false, note: "x", u: new Date(AT), d: new Date(LATER) },
        ],
      },
      "FROM daily_tasks": {
        rows: [
          { id: 5, cid: "c-5", td: "2026-08-13", title: "T", pid: 1, tid: 2, tt: "study", done: true, fm: 25, so: 0, u: new Date(AT), d: null },
          { id: 6, cid: null, td: "2026-08-12", title: "S", pid: null, tid: null, tt: "review", done: false, fm: 0, so: 1, u: new Date(AT), d: null },
        ],
      },
      "FROM focus_sessions": {
        rows: [
          { id: 9, cid: "c-9", tid: 5, st: new Date(AT), et: null, ds: 1500, tag: null, u: new Date(AT), d: null },
        ],
      },
      "FROM checkins": {
        rows: [
          { cd: "2026-08-13", note: "n", u: new Date(AT), d: null },
        ],
      },
      "FROM log_entries": {
        rows: [
          { id: 3, cid: "c-3", kind: "review", title: "L", content: "c", ca: new Date(AT), u: new Date(AT), d: null },
        ],
      },
      "FROM resume_assets": {
        rows: [
          { id: 4, cid: "c-4", title: "GH", url: "u", content: "c", u: new Date(AT), d: new Date(LATER) },
        ],
      },
      "FROM content_topics": {
        rows: [
          { id: 7, cid: "c-7", pid: 1, title: "CT", summary: null, so: 0, u: new Date(AT), d: null },
        ],
      },
    };
    const { client, query } = makeClient((sql) => {
      for (const key of Object.keys(script)) {
        if (sql.includes(key)) return script[key];
      }
      return { rows: [] };
    });

    const changes = await collectChangesSince(client, "u-1", new Date(EARLIER));

    expect(query).toHaveBeenCalledWith(expect.stringContaining("user_id = $1"), ["u-1", new Date(EARLIER)]);

    const byType = (t: string) => changes.filter((c) => c.entityType === t);

    // progress
    expect(byType("progress")).toEqual([
      expect.objectContaining({ entityId: "1", operation: "UPDATE", payload: { done: true, note: null } }),
      expect.objectContaining({ entityId: "2", operation: "DELETE", payload: null }),
    ]);
    // tasks: client id used when present, srv- fallback otherwise
    expect(byType("tasks")).toEqual([
      expect.objectContaining({ entityId: "c-5", payload: expect.objectContaining({ id: 5, clientId: "c-5" }) }),
      expect.objectContaining({ entityId: "srv-6", payload: expect.objectContaining({ id: 6, clientId: null }) }),
    ]);
    // sessions
    expect(byType("sessions")[0]).toEqual(
      expect.objectContaining({
        entityId: "c-9",
        payload: expect.objectContaining({ id: 9, clientId: "c-9", taskId: 5, durationSeconds: 1500 }),
      })
    );
    // checkins use natural key
    expect(byType("checkins")[0]).toEqual(
      expect.objectContaining({ entityId: "2026-08-13", payload: { checkinDate: "2026-08-13", note: "n" } })
    );
    // logs
    expect(byType("logs")[0]).toEqual(
      expect.objectContaining({ entityId: "c-3", payload: expect.objectContaining({ id: 3, clientId: "c-3", kind: "review" }) })
    );
    // github soft-deleted -> DELETE with null payload
    expect(byType("github")[0]).toEqual(
      expect.objectContaining({ entityId: "c-4", operation: "DELETE", payload: null })
    );
    // customTopics
    expect(byType("customTopics")[0]).toEqual(
      expect.objectContaining({ entityId: "c-7", payload: expect.objectContaining({ id: 7, clientId: "c-7", phaseId: 1 }) })
    );

    // every change has version 1 and ISO updatedAt
    for (const c of changes) {
      expect(c.version).toBe(1);
      expect(new Date(c.updatedAt).getTime()).not.toBeNaN();
    }
  });

  it("returns an empty list when nothing changed", async () => {
    const { client } = makeClient(() => ({ rows: [] }));
    const changes = await collectChangesSince(client, "u-1", new Date(0));
    expect(changes).toEqual([]);
  });
});

describe("recordSyncChanges", () => {
  it("inserts one row per change with JSON payloads", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    const changes = [
      change({ entityType: "progress", entityId: "1", payload: { done: true } }),
      change({ entityType: "tasks", entityId: "c-1", operation: "DELETE" }),
    ];
    await recordSyncChanges(client, "u-1", "dev-1", changes);

    const insertCalls = query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO sync_changes"));
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]).toEqual([
      "u-1", "dev-1", "progress", "1", "UPDATE", 1, JSON.stringify({ done: true }), new Date(AT),
    ]);
    expect(insertCalls[1][1]).toEqual([
      "u-1", "dev-1", "tasks", "c-1", "DELETE", 1, null, new Date(AT),
    ]);
  });
});

describe("upsertSyncDevice", () => {
  it("upserts with COALESCE name semantics", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await upsertSyncDevice(client, "u-1", "dev-1", "手机");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (user_id, device_id)"),
      ["u-1", "dev-1", "手机"]
    );
  });

  it("passes null when no name is given", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await upsertSyncDevice(client, "u-1", "dev-1");
    expect(query).toHaveBeenCalledWith(expect.any(String), ["u-1", "dev-1", null]);
  });
});

describe("B5 幂等键 (changeId)", () => {
  it("applyChanges 跳过已应用过的 changeId（客户端重试）", async () => {
    const { client, query } = makeClient((sql) =>
      sql.includes("FROM sync_changes") ? { rows: [{ "?column?": 1 }] } : { rows: [] }
    );
    const applied = await applyChanges(client, "u-1", [
      change({ entityType: "tasks", entityId: "c-1", changeId: "chg-1" }),
    ]);
    expect(applied).toBe(0);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT 1 FROM sync_changes WHERE user_id = $1 AND change_id = $2"),
      ["u-1", "chg-1"]
    );
  });

  it("recordSyncChanges 带 change_id 用 ON CONFLICT DO NOTHING（不重复审计）", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await recordSyncChanges(client, "u-1", "dev-1", [
      change({ entityType: "progress", entityId: "1", changeId: "chg-1" }),
    ]);
    const calls = query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO sync_changes"));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toContain("ON CONFLICT (user_id, change_id)");
    expect(calls[0][1]).toEqual(["u-1", "dev-1", "progress", "1", "UPDATE", 1, null, new Date(AT), "chg-1"]);
  });

  it("无 change_id 时保持原插入（旧客户端兼容）", async () => {
    const { client, query } = makeClient(() => ({ rows: [] }));
    await recordSyncChanges(client, "u-1", "dev-1", [
      change({ entityType: "checkins", entityId: "2026-08-13" }),
    ]);
    const calls = query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO sync_changes"));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).not.toContain("ON CONFLICT");
    expect(calls[0][1]).toEqual(["u-1", "dev-1", "checkins", "2026-08-13", "UPDATE", 1, null, new Date(AT)]);
  });
});

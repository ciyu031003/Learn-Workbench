import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));

import { pgPool } from "./db";
import { getProgressMap, getRoadmapWithProgress } from "./api";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProgressMap", () => {
  it("maps rows by topic_id", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { topic_id: 1, done: true, note: null },
        { topic_id: 2, done: false, note: "n" },
      ],
    } as never);
    const map = await getProgressMap("u-1");
    expect(map.get(1)).toEqual({ topic_id: 1, done: true, note: null });
    expect(map.get(2)).toEqual({ topic_id: 2, done: false, note: "n" });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1"),
      ["u-1"]
    );
  });

  it("passes null for anonymous users", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await getProgressMap(null);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [null]);
  });
});

describe("getRoadmapWithProgress", () => {
  function makeClient() {
    const query = vi.fn();
    const release = vi.fn();
    const client = { query, release };
    connectMock.mockResolvedValue(client as never);
    return { client, query, release };
  }

  it("assembles phases, topics and related rows with progress", async () => {
    const { query, release } = makeClient();
    const rowsFor = (sql: string) => {
      if (sql.includes("FROM content_phases")) return { rows: [{ id: 1, phase_key: "phase-0", title: "P0", weeks: null, track: "main", summary: null, sort_order: 0 }] };
      if (sql.includes("FROM content_topics")) return { rows: [{ id: 10, phase_id: 1, topic_key: "t1", title: "T1", summary: null, agent_task: null, sort_order: 0, is_custom: false }] };
      if (sql.includes("FROM content_resources")) return { rows: [{ id: 100, topic_id: 10, name: "r", url: null, kind: "doc", sort_order: 0 }] };
      if (sql.includes("FROM content_practices")) return { rows: [{ id: 200, topic_id: 10, text: "p", sort_order: 0 }] };
      if (sql.includes("FROM content_projects")) return { rows: [{ id: 300, topic_id: 10, name: "pr", description: null, repo_url: null, deliverable: null, sort_order: 0 }] };
      if (sql.includes("FROM content_checkpoints")) return { rows: [{ id: 400, topic_id: 10, text: "c", sort_order: 0 }] };
      if (sql.includes("FROM topic_progress")) return { rows: [{ topic_id: 10, done: true, note: "note!" }] };
      return { rows: [] };
    };
    query.mockImplementation((sql: string) => Promise.resolve(rowsFor(sql)));

    const phases = await getRoadmapWithProgress("u-1", "ict");
    expect(phases).toHaveLength(1);
    const topic = phases[0].topics[0];
    expect(topic).toMatchObject({
      id: 10,
      topicKey: "t1",
      title: "T1",
      done: true,
      note: "note!",
      isCustom: false,
    });
    expect(topic.resources).toEqual([{ id: 100, name: "r", url: null, kind: "doc", sortOrder: 0 }]);
    expect(topic.practices).toEqual([{ id: 200, text: "p", sortOrder: 0 }]);
    expect(topic.projects).toEqual([{ id: 300, name: "pr", description: null, repoUrl: null, deliverable: null, sortOrder: 0 }]);
    expect(topic.checkpoints).toEqual([{ id: 400, text: "c", sortOrder: 0 }]);
    expect(release).toHaveBeenCalled();
  });

  it("only includes topics that belong to the phase", async () => {
    const { query } = makeClient();
    const rowsFor = (sql: string) => {
      if (sql.includes("FROM content_phases")) return { rows: [{ id: 1, phase_key: "p1", title: "P1", weeks: null, track: "main", summary: null, sort_order: 0 }] };
      if (sql.includes("FROM content_topics")) return { rows: [{ id: 10, phase_id: 1, topic_key: "a", title: "A", summary: null, agent_task: null, sort_order: 0, is_custom: false }, { id: 11, phase_id: 999, topic_key: "b", title: "B", summary: null, agent_task: null, sort_order: 0, is_custom: false }] };
      return { rows: [] };
    };
    query.mockImplementation((sql: string) => Promise.resolve(rowsFor(sql)));
    const phases = await getRoadmapWithProgress(null);
    expect(phases[0].topics.map((t) => t.topicKey)).toEqual(["a"]);
  });
});

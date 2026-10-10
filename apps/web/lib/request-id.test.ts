import { describe, it, expect } from "vitest";
import { requestIdFrom, REQUEST_ID_HEADER } from "./request-id";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/x", { headers });
}

describe("requestIdFrom（H2）", () => {
  it("沿用上游可信的 x-request-id（便于全链路对齐）", () => {
    expect(requestIdFrom(req({ [REQUEST_ID_HEADER]: "trace-abc12345" }))).toBe("trace-abc12345");
  });

  it("没有传入时生成 UUID", () => {
    const id = requestIdFrom(req());
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("拒绝过短 / 超长 / 含非法字符的传入值（防日志注入）", () => {
    for (const bad of ["short", "a".repeat(129), "has space", "with/slash"]) {
      const id = requestIdFrom(req({ [REQUEST_ID_HEADER]: bad }));
      expect(id).not.toBe(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("每次无传入时生成的 ID 不同", () => {
    expect(requestIdFrom(req())).not.toBe(requestIdFrom(req()));
  });
});

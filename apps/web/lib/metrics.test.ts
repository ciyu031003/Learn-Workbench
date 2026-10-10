import { beforeEach, describe, expect, it, vi } from "vitest";
import { inc, observe, renderMetrics, resetMetrics, setGauge, timed } from "./metrics";

beforeEach(() => resetMetrics());

describe("metrics 计数器/仪表", () => {
  it("inc 累加，setGauge 覆盖", () => {
    inc("a_total");
    inc("a_total");
    setGauge("a_value", 5);
    setGauge("a_value", 7);
    const text = renderMetrics();
    expect(text).toContain("a_total 2");
    expect(text).toContain("a_value 7");
    expect(text).toContain("# TYPE a_total counter");
    expect(text).toContain("# TYPE a_value gauge");
  });

  it("标签键排序，保证同一组标签只有一条时间序列", () => {
    inc("x_total", { mode: "apply", status: "ok" });
    inc("x_total", { status: "ok", mode: "apply" });
    expect(renderMetrics()).toContain('x_total{mode="apply",status="ok"} 2');
  });

  it("标签值里的引号/反斜杠/换行被转义（防输出格式被破坏）", () => {
    inc("y_total", { reason: 'a"b\\c\nd' });
    const line = renderMetrics().split("\n").find((l) => l.startsWith("y_total"));
    expect(line).toBe('y_total{reason="a\\"b\\\\c\\nd"} 1');
  });

  it("直方图输出 _bucket/_sum/_count，+Inf 等于总数", () => {
    observe("z_ms", 4, { op: "import" });
    observe("z_ms", 300, { op: "import" });
    const text = renderMetrics();
    expect(text).toContain('z_ms_bucket{op="import",le="5"} 1');
    expect(text).toContain('z_ms_bucket{op="import",le="500"} 2');
    expect(text).toContain('z_ms_bucket{op="import",le="+Inf"} 2');
    expect(text).toContain('z_ms_sum{op="import"} 304');
    expect(text).toContain('z_ms_count{op="import"} 2');
  });

  it("外部指标（DB gauge）以 gauge 类型追加", () => {
    const text = renderMetrics([
      { name: "db_rows", help: "行数", type: "gauge", value: 12, labels: { table: "users" } },
    ]);
    expect(text).toContain("# HELP db_rows 行数");
    expect(text).toContain('db_rows{table="users"} 12');
  });

  it("renderMetrics 输出稳定（同样输入 → 同样字符串）", () => {
    inc("b_total");
    inc("a_total");
    expect(renderMetrics()).toBe(renderMetrics());
  });
});

describe("timed", () => {
  it("无论成功失败都记录耗时", async () => {
    const ok = await timed("t_ms", { path: "ok" }, async () => 42);
    expect(ok).toBe(42);
    await expect(
      timed("t_ms", { path: "fail" }, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    const text = renderMetrics();
    expect(text).toContain('t_ms_count{path="ok"} 1');
    expect(text).toContain('t_ms_count{path="fail"} 1');
  });

  it("透传返回值，不吞异常", async () => {
    const spy = vi.fn(async () => "v");
    expect(await timed("u_ms", {}, spy)).toBe("v");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

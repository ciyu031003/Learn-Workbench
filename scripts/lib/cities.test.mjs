import { test } from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_CITIES, CITY_MAP } from "./cities.js";

test("每个支持城市都有 zhilian 与 job51 平台编码", () => {
  for (const c of SUPPORTED_CITIES) {
    assert.ok(CITY_MAP[c], `缺少 ${c} 的平台编码`);
    assert.ok(CITY_MAP[c].zhilian, `缺少 ${c} 的 zhilian 编码`);
    assert.ok(CITY_MAP[c].job51, `缺少 ${c} 的 job51 编码`);
  }
});

test("CITY_MAP 键集合与 SUPPORTED_CITIES 一致（无多余/缺失）", () => {
  assert.deepEqual(Object.keys(CITY_MAP).sort(), [...SUPPORTED_CITIES].sort());
});
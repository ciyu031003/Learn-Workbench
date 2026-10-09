import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SUPPORTED_CITIES, CITY_MAP, CITY_NAME_PATTERN } from "./cities.js";

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

test("城市名单覆盖全国重点城市且解析正则完整", () => {
  assert.ok(SUPPORTED_CITIES.length >= 40, "城市数应至少为 40");
  assert.equal(new Set(SUPPORTED_CITIES).size, SUPPORTED_CITIES.length, "城市不应重复");
  for (const city of SUPPORTED_CITIES) {
    assert.match(city, new RegExp("^(" + CITY_NAME_PATTERN + ")$"));
  }
});

test("packages/shared 城市名单与爬虫字典保持一致", async () => {
  const sharedSource = await readFile(
    new URL("../../packages/shared/src/index.ts", import.meta.url),
    "utf8"
  );
  const declaration = sharedSource.match(/export const SUPPORTED_CITIES = \[([\s\S]*?)\];/);
  assert.ok(declaration, "未找到 shared SUPPORTED_CITIES 声明");
  const sharedCities = [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sharedCities, SUPPORTED_CITIES);
});

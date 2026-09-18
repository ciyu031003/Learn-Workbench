#!/usr/bin/env node
/**
 * 食物营养库导入（v6 P1-3）
 *
 * 数据源（只使用公开/可商用来源，决策 D1）：
 *   --source=builtin  自建中餐常见菜/食材（scripts/data/food-builtin.json，license=own）
 *   --source=off      Open Food Facts 搜索 API（license=ODbL-1.0，需署名 + 衍生库同许可）
 *   --source=usda     USDA FoodData Central（license=CC0-1.0，需 USDA_API_KEY）
 *
 * 用法：
 *   node scripts/import_food_db.mjs                                  # 导入自建库（默认）
 *   node scripts/import_food_db.mjs --dry-run                        # 只统计不写库
 *   node scripts/import_food_db.mjs --source=off --query=番茄鸡蛋面   # 追加 OFF 数据
 *   node scripts/import_food_db.mjs --source=usda --query=chicken --limit=50
 *
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD（与其它 seed 脚本一致）
 * 幂等：UNIQUE(source, source_id) + ON CONFLICT DO UPDATE；每次运行写一条 food_import_runs。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(prefix));
  if (!hit) return fallback;
  if (hit === `--${name}`) return true;
  return hit.slice(prefix.length);
}

const SOURCE = String(arg("source", "builtin"));
const LIMIT = Number(arg("limit", 0)) || 0;
const QUERY = arg("query", "");
const FILE = arg("file", "");
const DRY = Boolean(arg("dry-run", false));

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

/** 归一化一条记录（缺字段补默认值，保证 NOT NULL 与值域） */
function normalize(item, ctx) {
  const name = String(item.name ?? "").trim().slice(0, 120);
  if (!name) return null;
  return {
    source: ctx.source,
    sourceId: String(item.sourceId ?? item.source_id ?? "").trim() || `${ctx.source}-${name}`,
    name,
    nameEn: item.nameEn ? String(item.nameEn).slice(0, 160) : null,
    aliases: Array.isArray(item.aliases) ? item.aliases.map((a) => String(a).slice(0, 60)).slice(0, 10) : [],
    pinyin: item.pinyin ? String(item.pinyin).slice(0, 120) : null,
    category: item.category ? String(item.category).slice(0, 40) : null,
    mealTags: Array.isArray(item.mealTags)
      ? item.mealTags.filter((m) => ["breakfast", "lunch", "dinner", "snack"].includes(m)).slice(0, 4)
      : [],
    basisAmount: num(item.basisAmount ?? item.basis_amount ?? 100) || 100,
    basisUnit: String(item.basisUnit ?? item.basis_unit ?? "g").slice(0, 20),
    kcal: Math.max(0, num(item.kcal)),
    proteinG: Math.max(0, num(item.proteinG ?? item.protein_g)),
    carbsG: Math.max(0, num(item.carbsG ?? item.carbs_g)),
    fatG: Math.max(0, num(item.fatG ?? item.fat_g)),
    fiberG: item.fiberG === undefined || item.fiberG === null ? null : Math.max(0, num(item.fiberG)),
    sodiumMg: item.sodiumMg === undefined || item.sodiumMg === null ? null : Math.max(0, num(item.sodiumMg)),
    license: ctx.license,
  };
}

function loadBuiltin() {
  const file = FILE || path.join(ROOT, "scripts", "data", "food-builtin.json");
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const items = Array.isArray(doc) ? doc : doc.items ?? [];
  return { items, license: (doc.meta && doc.meta.license) || "own" };
}

/** Open Food Facts 搜索（ODbL 1.0）—— 只取有中文名/名称与完整热量四件套的条目 */
async function loadOff(query, limit) {
  const q = query || "番茄鸡蛋面";
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(100, limit || 50)));
  url.searchParams.set("fields", "code,product_name,product_name_zh,nutriments");
  const res = await fetch(url, { headers: { "User-Agent": "Learn-Workbench/1.0 (food import)" } });
  if (!res.ok) throw new Error(`OFF 请求失败: ${res.status}`);
  const data = await res.json();
  const items = (data.products ?? [])
    .map((p) => {
      const n = p.nutriments ?? {};
      const kcal = n["energy-kcal_100g"];
      if (!p.code || kcal === undefined) return null;
      return {
        sourceId: String(p.code),
        name: p.product_name_zh || p.product_name || "",
        aliases: p.product_name_zh && p.product_name && p.product_name !== p.product_name_zh ? [p.product_name] : [],
        category: "包装食品",
        basisAmount: 100,
        basisUnit: "g",
        kcal: num(kcal),
        proteinG: num(n.proteins_100g),
        carbsG: num(n.carbohydrates_100g),
        fatG: num(n.fat_100g),
      };
    })
    .filter(Boolean);
  return { items, license: "ODbL-1.0" };
}

/** USDA FoodData Central（CC0 公有领域）—— 营养成分按每 100g 返回 */
async function loadUsda(query, limit) {
  const key = process.env.USDA_API_KEY || "DEMO_KEY";
  if (!query) throw new Error("USDA 需要 --query=<英文关键词>");
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(Math.min(200, limit || 50)));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA 请求失败: ${res.status}`);
  const data = await res.json();
  const pick = (nutrients, id) => {
    const hit = (nutrients ?? []).find((x) => x.nutrientId === id);
    return hit ? num(hit.value) : 0;
  };
  const items = (data.foods ?? []).map((f) => ({
    sourceId: String(f.fdcId),
    name: f.description,
    nameEn: f.description,
    category: f.foodCategory || "USDA",
    basisAmount: 100,
    basisUnit: "g",
    kcal: pick(f.foodNutrients, 1008),
    proteinG: pick(f.foodNutrients, 1003),
    carbsG: pick(f.foodNutrients, 1005),
    fatG: pick(f.foodNutrients, 1004),
  }));
  return { items, license: "CC0-1.0" };
}

async function main() {
  let loaded;
  if (SOURCE === "builtin") loaded = loadBuiltin();
  else if (SOURCE === "off") loaded = await loadOff(QUERY, LIMIT);
  else if (SOURCE === "usda") loaded = await loadUsda(QUERY, LIMIT);
  else throw new Error(`未知数据源: ${SOURCE}（可选 builtin | off | usda）`);

  const ctx = { source: SOURCE, license: loaded.license };
  let rows = loaded.items.map((it) => normalize(it, ctx)).filter(Boolean);
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  console.log(`[food] 源=${SOURCE} 许可=${ctx.license} 待写入 ${rows.length} 条`);
  if (DRY) {
    console.log("[food] --dry-run：以下为前 5 条样例");
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log("[food] 没有可写入的数据，结束");
    return;
  }

  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "Learn-Workbench",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: 3,
  });
  try {
    let upserted = 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of rows) {
        const res = await client.query(
          `INSERT INTO food_items (source, source_id, name, name_en, aliases, pinyin, category, meal_tags,
                                  basis_amount, basis_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, license)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (source, source_id) DO UPDATE SET
             name = EXCLUDED.name, name_en = EXCLUDED.name_en, aliases = EXCLUDED.aliases,
             pinyin = EXCLUDED.pinyin, category = EXCLUDED.category, meal_tags = EXCLUDED.meal_tags,
             basis_amount = EXCLUDED.basis_amount, basis_unit = EXCLUDED.basis_unit,
             kcal = EXCLUDED.kcal, protein_g = EXCLUDED.protein_g, carbs_g = EXCLUDED.carbs_g,
             fat_g = EXCLUDED.fat_g, fiber_g = EXCLUDED.fiber_g, sodium_mg = EXCLUDED.sodium_mg,
             license = EXCLUDED.license, updated_at = now()`,
          [r.source, r.sourceId, r.name, r.nameEn, r.aliases, r.pinyin, r.category, r.mealTags,
           r.basisAmount, r.basisUnit, r.kcal, r.proteinG, r.carbsG, r.fatG, r.fiberG, r.sodiumMg, r.license]
        );
        upserted += res.rowCount ?? 0;
      }
      await client.query(
        `INSERT INTO food_import_runs (source, license, rows_in, rows_upserted, note) VALUES ($1,$2,$3,$4,$5)`,
        [SOURCE, ctx.license, rows.length, upserted, QUERY ? `query=${QUERY}` : null]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    console.log(`[food] 写入完成：${upserted} 条（含更新）`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[food] 失败：${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});

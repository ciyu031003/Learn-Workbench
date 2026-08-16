#!/usr/bin/env node
/**
 * create-admin.mjs
 * 创建 / 重置 Learn-Workbench 管理员账号（不再内置默认账号/默认密码）。
 *
 * 用法：
 *   node scripts/create-admin.mjs --username <用户名> --password <强密码>
 *   node scripts/create-admin.mjs --username <用户名>          # 自动生成随机密码并打印一次
 *   ADMIN_USERNAME=xxx ADMIN_PASSWORD=yyy node scripts/create-admin.mjs
 *
 * 说明：密码使用 scrypt(salt:hash) 存储，与 apps/web/lib/password.ts 一致。
 */
import { randomBytes, scryptSync } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
function loadPg() {
  try { return require("pg"); } catch {}
  const candidates = [
    path.join(process.cwd(), "apps/web/node_modules/pg"),
    path.join(process.cwd(), "node_modules/pg"),
    path.join(process.cwd(), "..", "apps/web/node_modules/pg"),
  ];
  for (const c of candidates) {
    try { return require(c); } catch {}
  }
  throw new Error("找不到 pg 模块，请先执行 pnpm install（apps/web 依赖）");
}
const pg = loadPg();

const args = process.argv.slice(2);
function argVal(name, envName) {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return process.env[envName];
}

const username = argVal("--username", "ADMIN_USERNAME");
let password = argVal("--password", "ADMIN_PASSWORD");

if (!username) {
  console.error("用法: node scripts/create-admin.mjs --username <用户名> [--password <强密码>]");
  process.exit(1);
}

function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

let generated = false;
if (!password) {
  password = randomBytes(12).toString("base64url"); // 16 字符
  generated = true;
}

const pool = new pg.Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "Learn-Workbench",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000,
});

try {
  const hash = hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1) upsert user（本地无邮箱，按 display_name 匹配；display_name 无唯一约束，需先查后插）
    const existing = await client.query(`SELECT id FROM users WHERE display_name = $1`, [username]);
    let userId = existing.rows[0]?.id ?? null;
    if (!userId) {
      const ins = await client.query(
        `INSERT INTO users (display_name) VALUES ($1) RETURNING id`,
        [username]
      );
      userId = ins.rows[0]?.id;
    }
    if (!userId) {
      throw new Error("无法定位/创建 user 记录");
    }
    // 2) upsert account
    await client.query(
      `INSERT INTO accounts (username, password_hash, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, user_id = EXCLUDED.user_id, updated_at = now()`,
      [username, hash, userId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  console.log("✔ 管理员账号已创建/重置：", username);
  if (generated) {
    console.log("────────────────────────────────────────────");
    console.log("  新密码（仅显示一次，请立即保存）: " + password);
    console.log("────────────────────────────────────────────");
  } else {
    console.log("密码已按传入值设置。");
  }
} catch (e) {
  console.error("创建失败:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

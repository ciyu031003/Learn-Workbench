import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number }
) => Promise<Buffer>;

/**
 * 密码哈希（P0 加固）：
 * - 异步 scrypt，不再用 scryptSync 阻塞事件循环（防登录接口 DoS）
 * - 新格式带成本参数：scrypt:N:r:p:salt:hash（便于未来升级参数）
 * - 旧格式（salt:hash，Node 默认参数 N=16384,r=8,p=1）兼容校验，登录成功后自动升级
 */
const PREFIX = "scrypt:";
const DEFAULT_COST = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }; // ~64MB，异步执行
const LEGACY_COST = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULT_COST;
  const hash = await scryptAsync(password, salt, 64, DEFAULT_COST);
  return `${PREFIX}${N}:${r}:${p}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** 旧格式哈希（无成本参数前缀）需要升级 */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(PREFIX);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith(PREFIX)) {
      const [, n, r, p, saltHex, hashHex] = stored.split(":");
      const salt = Buffer.from(saltHex, "hex");
      const expected = Buffer.from(hashHex, "hex");
      if (!expected.length) return false;
      const candidate = await scryptAsync(password, salt, expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: 256 * 1024 * 1024,
      });
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    }
    // 旧格式：salt:hash —— 旧实现把随机盐的 hex 字符串直接作为 salt 传入 scrypt（UTF-8 字节），
    // 因此校验时必须原样传字符串，不能 hex 解码
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    if (!expected.length) return false;
    const candidate = await scryptAsync(password, saltHex, expected.length, LEGACY_COST);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
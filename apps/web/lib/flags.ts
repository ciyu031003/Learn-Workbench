/**
 * 特性开关与灰度（组三 · H4 交付补强）。
 *
 * 取舍：**不引第三方 SDK**。单实例自用系统里，环境变量 + 重启就已经能"先关掉、再排查、再灰度放量"；
 * 引入配置中心只会多一个要维护、要鉴权、要监控的外部依赖。
 *
 * 取值规则（大小写不敏感）：
 *   on / 1 / true / yes   → 开
 *   off / 0 / false / no  → 关
 *   其它（含缺省）        → 用代码里声明的 defaultEnabled
 * 两种写法：
 *   FEATURE_AI_TIP=off                     单开关（名字 = flag 名的大写下划线形式）
 *   FEATURE_FLAGS={"ai_tip":false}         批量 JSON（优先级更高）
 */

export const FLAGS = {
  ai_tip: {
    defaultEnabled: true,
    description: "AI 学习提示接口（/api/ai/tip）；无 key 时本来就不可用，这个开关用于快速止血",
  },
  internal_content_web: {
    defaultEnabled: true,
    description: "允许内容角色（admin/editor/reviewer）登录后在浏览器触发内部内容接口（除密钥外的新通道）",
  },
} as const;

export type FlagName = keyof typeof FLAGS;

const TRUTHY = new Set(["on", "1", "true", "yes"]);
const FALSY = new Set(["off", "0", "false", "no"]);

function parseOverride(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  const token = String(value).trim().toLowerCase();
  if (TRUTHY.has(token)) return true;
  if (FALSY.has(token)) return false;
  return null;
}

function envKeyOf(name: string): string {
  return `FEATURE_${name.toUpperCase()}`;
}

/** 解析 `FEATURE_FLAGS`（JSON）；坏 JSON 视为没配（不能让一个手滑的变量把服务打挂）。 */
function parseBulk(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function isFlagEnabled(name: FlagName, env: NodeJS.ProcessEnv = process.env): boolean {
  const bulk = parseBulk(env.FEATURE_FLAGS);
  const override = parseOverride(bulk[name]) ?? parseOverride(env[envKeyOf(name)]);
  if (override !== null) return override;
  return FLAGS[name].defaultEnabled;
}

/** 一次性快照，便于日志/诊断接口记录"当时开关是什么"。 */
export function flagsSnapshot(env: NodeJS.ProcessEnv = process.env): Record<FlagName, boolean> {
  const out = {} as Record<FlagName, boolean>;
  for (const name of Object.keys(FLAGS) as FlagName[]) out[name] = isFlagEnabled(name, env);
  return out;
}

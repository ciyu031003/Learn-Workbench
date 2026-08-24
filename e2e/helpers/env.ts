import fs from "node:fs";
import path from "node:path";

// 轻量 .env 读取（不引入 dotenv 依赖）：只解析 KEY=VALUE 行
export function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(__dirname, "..", ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  // 进程环境变量优先
  for (const k of ["E2E_BASE_URL", "E2E_USERNAME", "E2E_PASSWORD", "E2E_CHROME_PATH", "E2E_CHANNEL"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  return out;
}

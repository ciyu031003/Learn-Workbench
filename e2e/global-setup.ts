import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./helpers/env";

// 全局前置：用管理员账号登录一次，把 lwb_session 写入 .auth/user.json
// 供所有测试通过 storageState 复用（避免每个用例都走登录页）
export default async function globalSetup() {
  const env = loadEnv();
  const baseURL = (env.E2E_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
  const username = env.E2E_USERNAME || "";
  const password = env.E2E_PASSWORD || "";
  if (!username || !password) {
    console.warn("[e2e] 未配置 E2E_USERNAME/E2E_PASSWORD，登录相关测试将被跳过");
    return;
  }
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  const res = await api.post("/api/auth/login", { data: { username, password, claimLegacy: true } });
  if (!res.ok()) {
    console.warn(`[e2e] 登录失败 HTTP ${res.status()}，登录相关测试将被跳过`);
    await api.dispose();
    return;
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) {
    console.warn("[e2e] 登录响应缺少 token，登录相关测试将被跳过");
    await api.dispose();
    return;
  }
  const url = new URL(baseURL);
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(
    path.join(authDir, "user.json"),
    JSON.stringify({
      cookies: [
        {
          name: "lwb_session",
          value: body.token,
          domain: url.hostname,
          path: "/",
          httpOnly: true,
          secure: url.protocol === "https:",
          sameSite: "Lax",
        },
      ],
      origins: [],
    })
  );
  await api.dispose();
  console.log(`[e2e] 登录成功，storageState 已写入 .auth/user.json（baseURL=${baseURL}）`);
}

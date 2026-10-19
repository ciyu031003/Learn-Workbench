import fs from "node:fs";
import { request as playwrightRequest, type APIRequestContext, type BrowserContextOptions } from "@playwright/test";
import { AUTH_FILE, hasAuth } from "./auth";
import { loadEnv } from "./env";

/** 与 playwright.config 一致：E2E_BASE_URL 优先，默认本地 dev。 */
export function e2eBaseURL(): string {
  const env = loadEnv();
  return (env.E2E_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
}

export interface E2ECredentials {
  username: string;
  password: string;
}

/** 登录凭据（E2E_USERNAME/E2E_PASSWORD）；未配置时返回 null（用例应 skip 并打印原因）。 */
export function credentials(): E2ECredentials | null {
  const env = loadEnv();
  const username = (env.E2E_USERNAME || "").trim();
  const password = env.E2E_PASSWORD || "";
  return username && password ? { username, password } : null;
}

export const NO_CREDENTIALS_REASON =
  "未配置 E2E_USERNAME/E2E_PASSWORD（e2e/.env 或进程环境变量）：跳过需要登录的用例";

export const NO_SESSION_REASON =
  "global-setup 未生成 .auth/user.json（登录失败/凭据错误）：跳过需要登录态的用例";

/**
 * global-setup 写出的 storageState 没有 cookie.expires（浏览器上下文能容忍），
 * 但 request.newContext 会严格校验（expires: expected float）——这里补成 -1（会话 cookie）。
 */
export function authedStorageState(): Exclude<BrowserContextOptions["storageState"], string | undefined> {
  if (!hasAuth()) throw new Error(NO_SESSION_REASON);
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as {
    cookies?: Record<string, unknown>[];
    origins?: unknown[];
  };
  const cookies = (raw.cookies ?? []).map((cookie) => ({ expires: -1, ...cookie }));
  return { cookies, origins: (raw.origins ?? []) } as Exclude<BrowserContextOptions["storageState"], string | undefined>;
}

/** 登录态 API 上下文（复用 global-setup 写入的 storageState）。调用方负责 dispose。 */
export async function newAuthedApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: e2eBaseURL(),
    storageState: authedStorageState(),
    ignoreHTTPSErrors: true,
    timeout: 20_000,
  });
}

/** 匿名 API 上下文。调用方负责 dispose。 */
export async function newAnonApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: e2eBaseURL(),
    ignoreHTTPSErrors: true,
    timeout: 20_000,
  });
}

/** 需要在用例开头调用：凭据或登录态缺失时打印原因并 skip。 */
export function hasLoggedInSession(): boolean {
  return hasAuth();
}

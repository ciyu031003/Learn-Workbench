import { getApiUrl } from "@/config";

export { identityInitial, identityName } from "./identity-name";

export interface IdentityPayload {
  displayName: string | null;
  avatarUrl: string | null;
}

function normalizeIdentity(user: unknown): IdentityPayload | null {
  if (!user || typeof user !== "object") return null;
  const value = user as { displayName?: unknown; avatarUrl?: unknown };
  return {
    displayName: typeof value.displayName === "string" ? value.displayName : null,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
  };
}

/** 启动 / 登录后从服务端回填昵称与头像；失败不阻塞启动，保留本机缓存 */
export async function fetchIdentity(token: string): Promise<IdentityPayload | null> {
  if (!token) return null;
  try {
    const res = await fetch(getApiUrl() + "/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return normalizeIdentity(data?.user);
  } catch {
    return null;
  }
}

/** 保存昵称 / 头像；失败抛出可直接展示的中文文案 */
export async function updateIdentity(
  token: string,
  input: { displayName: string; avatarUrl: string | null }
): Promise<IdentityPayload> {
  const res = await fetch(getApiUrl() + "/api/auth/me", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "保存失败，请稍后重试");
  const identity = normalizeIdentity(data?.user);
  if (!identity) throw new Error("保存失败，请稍后重试");
  return identity;
}

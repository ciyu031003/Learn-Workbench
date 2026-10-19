"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Fetcher } from "./use-jobs-settings";

/**
 * 账号 / 修改密码 / 退出登录（S6-4：从 settings/page.tsx 抽出）。
 * 校验与请求都抽成纯 async 函数，便于单测。
 */

export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

/** 返回第一条可读错误；null 表示通过 */
export function validatePasswordChange(input: PasswordChangeInput): string | null {
  if (!input.current || !input.next || !input.confirm) return "请填写完整";
  if (input.next !== input.confirm) return "两次输入的新密码不一致";
  if (input.next.length < 8) return "新密码至少 8 位";
  if (input.next.length > 128) return "密码最多 128 位";
  return null;
}

export interface PasswordChangeResult {
  ok: boolean;
  message: string;
}

export async function submitPasswordChange(fetcher: Fetcher, input: PasswordChangeInput): Promise<PasswordChangeResult> {
  const invalid = validatePasswordChange(input);
  if (invalid) return { ok: false, message: invalid };
  try {
    const r = await fetcher("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: input.current, newPassword: input.next }),
    });
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    if (!r.ok) return { ok: false, message: data?.error ?? "修改失败" };
    return { ok: true, message: "密码修改成功" };
  } catch {
    return { ok: false, message: "网络异常，请稍后重试" };
  }
}

export interface AccountSettingsApi {
  user: { username: string; displayName: string | null } | null;
  pwCurrent: string;
  pwNew: string;
  pwConfirm: string;
  pwMsg: string | null;
  pwOk: boolean | null;
  pwBusy: boolean;
  setPwCurrent: (v: string) => void;
  setPwNew: (v: string) => void;
  setPwConfirm: (v: string) => void;
  changePassword: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAccountSettings(): AccountSettingsApi {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<boolean | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);

  const changePassword = useCallback(async () => {
    setPwBusy(true);
    setPwMsg(null);
    setPwOk(null);
    const result = await submitPasswordChange(fetch, { current: pwCurrent, next: pwNew, confirm: pwConfirm });
    setPwMsg(result.message);
    setPwOk(result.ok);
    if (result.ok) {
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    }
    setPwBusy(false);
  }, [pwCurrent, pwNew, pwConfirm]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  return {
    user,
    pwCurrent, pwNew, pwConfirm, pwMsg, pwOk, pwBusy,
    setPwCurrent, setPwNew, setPwConfirm,
    changePassword, logout,
  };
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, Lock, LogOut, User as UserIcon } from "lucide-react";
import type { AccountSettingsApi } from "../_hooks/use-account-settings";

/** 账号 + 修改密码（S6-4：从 settings/page.tsx 抽出） */
export function AccountCards({ account }: { account: AccountSettingsApi }) {
  const { user, pwCurrent, pwNew, pwConfirm, pwMsg, pwOk, pwBusy, setPwCurrent, setPwNew, setPwConfirm, changePassword, logout } = account;
  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="size-5 text-primary" />
            <CardTitle>账号</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">当前登录</span>
            <Badge variant="success">{user?.username ?? "未登录"}</Badge>
          </div>
          <Button variant="outline" onClick={logout} className="justify-start">
            <LogOut className="size-4" /> 退出登录
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Lock className="size-5 text-primary" />
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="当前密码"
            autoComplete="current-password"
            className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              placeholder="新密码（至少 8 位）"
              autoComplete="new-password"
              className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
            <input
              type="password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              placeholder="确认新密码"
              autoComplete="new-password"
              className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
            />
          </div>
          {pwMsg ? <p className={`text-xs ${pwOk ? "text-success" : "text-danger"}`}>{pwMsg}</p> : null}
          <Button onClick={changePassword} disabled={pwBusy} className="self-end">
            <KeyRound className="size-4" /> {pwBusy ? "提交中…" : "保存新密码"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

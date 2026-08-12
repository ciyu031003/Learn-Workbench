"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { Download, Upload, Database, Image as ImageIcon, Sparkles, RefreshCw, LogOut, User as UserIcon } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const backgroundEnabled = useUiStore((s) => s.backgroundEnabled);
  const toggleBackground = useUiStore((s) => s.toggleBackground);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [user, setUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => setDbOk(r.ok))
      .catch(() => setDbOk(false));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const exportJson = async () => {
    const r = await fetch("/api/export");
    const data = await r.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `learn-workbench-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("已导出备份文件");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const r = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    setMsg(r.ok ? "导入成功，数据已恢复" : "导入失败：格式不正确");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div>
        <h1 className="page-title text-2xl font-semibold tracking-tight lg:text-3xl">设置</h1>
        <p className="page-subtitle mt-1 text-sm">外观、背景图、数据备份与同步</p>
      </div>

      {msg ? <Badge variant="success">{msg}</Badge> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            <CardTitle>每日背景图</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">每日 Bing 壁纸</p>
                <p className="text-xs text-muted-foreground">每天由爬虫抓取 Bing 每日壁纸并自动更换</p>
              </div>
              <Switch checked={backgroundEnabled} onCheckedChange={toggleBackground} />
            </div>
            <p className="text-xs text-muted-foreground">关闭后使用简洁渐变背景。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle>外观</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">主题模式</p>
              <p className="text-xs text-muted-foreground">浅色 / 深色（开发中，基础支持）</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                浅色
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                深色
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Database className="size-5 text-primary" />
            <CardTitle>数据与备份</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">数据库</span>
              {dbOk === null ? (
                <span className="text-xs text-muted-foreground">检测中…</span>
              ) : dbOk ? (
                <Badge variant="success">已连接 · Learn-Workbench</Badge>
              ) : (
                <Badge variant="muted">未连接（请运行 scripts\\start_pg.ps1）</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={exportJson} className="flex-1">
                <Download className="size-4" /> 导出备份
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="flex-1">
                <Upload className="size-4" /> 导入备份
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">JSON 备份含进度、任务、专注、日志与打卡，可跨设备恢复。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            <CardTitle>云同步（P1）</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Supabase 登录与云同步将在 P1 提供：多设备进度互通、证书倒计时、面试题库、本地提醒。</p>
            <Button variant="outline" disabled>
              同步功能开发中
            </Button>
          </CardContent>
        </Card>
      </div>

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
        <CardHeader>
          <CardTitle>关于</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>ICT 学习工作台 v0.1（M0-M3 基础版）</p>
          <p className="mt-1">技术栈：Next.js 16 + Expo + PostgreSQL 18.4 + 每日 Bing 壁纸</p>
          <p className="mt-1">内容来源：《新疆ICT学习规划优化方案》</p>
        </CardContent>
      </Card>
    </div>
  );
}



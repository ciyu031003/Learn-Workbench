"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeSegmented } from "@/components/ui/theme-segmented";
import { useSystemDark } from "@/components/theme-provider";
import { useUiStore } from "@/store/ui-store";
import { FOCUS_GALLERY, useFocusBgStore } from "@/store/focus-bg-store";
import { useToastStore } from "@/store/toast-store";
import { Database, Download, Image as ImageIcon, ImagePlus, Images, Palette, RefreshCw, Sparkles, Upload } from "lucide-react";
import type { BackupSettingsApi } from "../_hooks/use-backup-settings";

/** 外观 / 专注背景 / 数据备份 / 云同步（S6-4：从 settings/page.tsx 抽出） */
export function AppearanceSection({ backup }: { backup: BackupSettingsApi }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const focusMode = useFocusBgStore((s) => s.mode);
  const focusColor = useFocusBgStore((s) => s.color);
  const focusUploadUrl = useFocusBgStore((s) => s.uploadUrl);
  const focusGalleryId = useFocusBgStore((s) => s.galleryId);
  const focusBg = useFocusBgStore();
  const pushToast = useToastStore((s) => s.push);
  const systemDark = useSystemDark();
  const { dbOk, fileRef, exportJson, importJson } = backup;
  const [wallpaperBusy, setWallpaperBusy] = useState(false);
  const refreshWallpaper = async () => {
    setWallpaperBusy(true);
    try {
      const r = await fetch("/api/background/refresh", { method: "POST" });
      const d = await r.json().catch(() => null);
      pushToast(d?.ok ? "壁纸已刷新" : `刷新失败：${d?.error ?? "未知错误"}`, d?.ok ? "success" : "error");
    } catch {
      pushToast("刷新失败：网络异常", "error");
    } finally {
      setWallpaperBusy(false);
    }
  };

  return (
    <>
      <SectionLabel>外观与体验</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            <CardTitle>专注页背景</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">仅全屏专注计时会显示背景图；其他页面保持油画浅色画布，不再使用壁纸。</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "gallery", label: "图库", icon: Images },
                { key: "color", label: "纯色", icon: Palette },
                { key: "upload", label: "自定义图片", icon: ImagePlus },
              ].map((m) => (
                <Button
                  key={m.key}
                  size="sm"
                  variant={focusMode === m.key ? "default" : "outline"}
                  onClick={() => focusBg.setMode(m.key as typeof focusMode)}
                >
                  <m.icon />
                  {m.label}
                </Button>
              ))}
            </div>
            {focusMode === "gallery" ? (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {FOCUS_GALLERY.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => focusBg.setGalleryId(g.id)}
                      className={
                        focusGalleryId === g.id
                          ? "flex h-12 items-center justify-center overflow-hidden rounded-xl border-2 border-primary px-1 text-[11px] font-semibold text-white"
                          : "flex h-12 items-center justify-center overflow-hidden rounded-xl border border-border px-1 text-[11px] font-semibold text-white/85"
                      }
                      style={g.css ? { background: g.css } : { backgroundImage: "linear-gradient(135deg,#3b6b8f,#8b5f8f)" }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">默认使用每日 Bing 壁纸；刷新会立即抓取当天的图。</p>
                  <Button variant="secondary" size="sm" onClick={refreshWallpaper} disabled={wallpaperBusy}>
                    <RefreshCw className="size-3.5" /> {wallpaperBusy ? "刷新中…" : "刷新 Bing 壁纸"}
                  </Button>
                </div>
              </>
            ) : null}
            {focusMode === "color" ? (
              <div className="flex flex-wrap gap-2">
                {["#0f172a", "#1f2937", "#14532d", "#1e3a8a", "#4c1d95", "#7c2d12"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => focusBg.setColor(c)}
                    aria-label={`专注背景色 ${c}`}
                    className={focusColor === c ? "size-8 rounded-full border-2 border-primary" : "size-8 rounded-full border border-border"}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground">
                  自定义
                  <input
                    type="color"
                    value={focusColor}
                    onChange={(e) => focusBg.setColor(e.target.value)}
                    className="size-5 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            ) : null}
            {focusMode === "upload" ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                {focusUploadUrl ? "已上传自定义图片，点击可更换" : "上传自定义图片（仅专注页使用）"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 3 * 1024 * 1024) {
                      pushToast("图片不能超过 3MB", "error");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => focusBg.setUploadUrl(typeof reader.result === "string" ? reader.result : null);
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
            ) : null}
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
              <p className="text-xs text-muted-foreground">
                浅色 / 深色 / 跟随系统
                {theme === "auto" ? `（当前：${systemDark === true ? "深色" : "浅色"}）` : ""}
              </p>
            </div>
            <ThemeSegmented value={theme} onChange={setTheme} />
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
                <Badge variant="muted">未连接（请运行 scripts\start_pg.ps1）</Badge>
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
    </>
  );
}

/** 关于卡片（从 settings/page.tsx 抽出） */
export function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>学习工作台 v0.3（多职业路线 + 液态玻璃 UI）</p>
        <p className="mt-1">技术栈：Next.js 16 + Expo + PostgreSQL 18.4 + 每日 Bing 壁纸</p>
        <p className="mt-1">内容来源：《新疆ICT学习规划优化方案》</p>
      </CardContent>
    </Card>
  );
}

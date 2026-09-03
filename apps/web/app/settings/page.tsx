"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/store/ui-store";
import { useToastStore } from "@/store/toast-store";
import { useRouter } from "next/navigation";
import type { JobCrawlerConfig, JobRun, JobSource, JobSourceInfo, JobStats, JobSubscription } from "@learn-workbench/shared";
import { allJobCategories, experimentalJobSources, formatRelativeTime, jobCategoryLabels, jobSourceLabel, jobSourceLabels } from "@learn-workbench/shared";
import {
  Database,
  Download,
  Flower2,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  Activity,
  Bell,
  CalendarClock,
  Heart,
  Plus,
  Server,
  Trash2,
  User as UserIcon,
  X,
  Zap,
} from "lucide-react";

type ChipEditorProps = {
  label: string;
  placeholder?: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

function ChipEditor({ label, placeholder, items, onAdd, onRemove }: ChipEditorProps) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft("");
  };
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`删除 ${item}`} className="text-emerald-600/70 hover:text-emerald-700 dark:hover:text-emerald-200">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder ?? "输入后回车添加"}
          className="h-8 w-28 rounded-full border border-dashed border-white/30 bg-transparent px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
      </div>
    </div>
  );
}

function NewSubscriptionForm({ onSave }: { onSave: (sub: { name: string; categories: string[]; keywords: string[]; cities: string[] }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cats, setCats] = useState<string[]>(["yangqi"]);
  const [kw, setKw] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleCat = (c: string) => {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const submit = async () => {
    const keywords = kw.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
    const cities = city.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!name.trim() && keywords.length === 0) return;
    setBusy(true);
    try {
      await onSave({
        name: name.trim() || (cats.length ? cats.map((c) => jobCategoryLabels[c as never] ?? c).join("·") : "我的订阅"),
        categories: cats,
        keywords,
        cities,
      });
      setName("");
      setKw("");
      setCity("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-3">
      <p className="text-xs font-medium text-muted-foreground">新建订阅</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {allJobCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggleCat(c)}
            className={cats.includes(c)
              ? "rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-2.5 py-1 text-[11px] font-semibold text-white"
              : "rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            }
          >
            {jobCategoryLabels[c]}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="订阅名称，如 央国企×北京（可选）"
        className="mt-2 h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="关键词：如 网络工程、数据分析"
          className="h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="地区：如 北京、乌鲁木齐"
          className="h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
      </div>
      <Button size="sm" onClick={submit} disabled={busy} className="mt-2">
        {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        创建订阅
      </Button>
    </div>
  );
}

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
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<boolean | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const pushToast = useToastStore((s) => s.push);
  const [wallpaperBusy, setWallpaperBusy] = useState(false);
  const [crawler, setCrawler] = useState<JobCrawlerConfig | null>(null);
  const [crawlerBusy, setCrawlerBusy] = useState(false);
  const [crawlerRunBusy, setCrawlerRunBusy] = useState(false);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [sources, setSources] = useState<JobSourceInfo[]>([]);
  const [hostsMeta, setHostsMeta] = useState<{ version: number; updatedAt: string | null } | null>(null);
  const [hostsBusy, setHostsBusy] = useState(false);
  const [subscriptions, setSubscriptions] = useState<JobSubscription[]>([]);
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

  // 「跟随壁纸」档位下展示当前亮度判定结果（bg-dark 由 daily-background 写入）
  const [autoTone, setAutoTone] = useState<"light" | "dark">("light");
  useEffect(() => {
    const update = () =>
      setAutoTone(document.documentElement.classList.contains("bg-dark") ? "dark" : "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const loadCrawlerData = async () => {
    try {
      const [configR, runsR, statsR, sourcesR, subsR] = await Promise.allSettled([
        fetch("/api/jobs/config").then(async (r) => {
          if (!r.ok) throw new Error("招聘配置加载失败");
          return (await r.json()) as { config: JobCrawlerConfig };
        }),
        fetch("/api/jobs/runs").then(async (r) => {
          if (!r.ok) throw new Error("运行日志加载失败");
          return (await r.json()) as { runs: JobRun[] };
        }),
        fetch("/api/jobs/stats").then(async (r) => {
          if (!r.ok) throw new Error("招聘统计加载失败");
          return (await r.json()) as JobStats;
        }),
        fetch("/api/jobs/sources").then(async (r) => {
          if (!r.ok) throw new Error("信息源加载失败");
          return (await r.json()) as { sources: JobSourceInfo[]; version: number; updatedAt: string | null };
        }),
        fetch("/api/jobs/subscriptions").then(async (r) => {
          if (!r.ok) throw new Error("订阅加载失败");
          return (await r.json()) as { subscriptions: JobSubscription[] };
        }),
      ]);
      if (configR.status === "fulfilled") setCrawler(configR.value.config);
      else pushToast(configR.reason?.message ?? "招聘配置加载失败", "error");
      if (runsR.status === "fulfilled") setJobRuns(runsR.value.runs ?? []);
      else pushToast(runsR.reason?.message ?? "运行日志加载失败", "error");
      if (statsR.status === "fulfilled") setJobStats(statsR.value);
      else pushToast(statsR.reason?.message ?? "招聘统计加载失败", "error");
      if (sourcesR.status === "fulfilled") {
        setSources(sourcesR.value.sources ?? []);
        setHostsMeta({ version: sourcesR.value.version ?? 0, updatedAt: sourcesR.value.updatedAt ?? null });
      } else {
        pushToast(sourcesR.reason?.message ?? "信息源加载失败", "error");
      }
      if (subsR.status === "fulfilled") setSubscriptions(subsR.value.subscriptions ?? []);
    } catch {
      pushToast("招聘爬虫数据加载失败", "error");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCrawlerData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCrawler = async () => {
    if (!crawler) return;
    setCrawlerBusy(true);
    try {
      const r = await fetch("/api/jobs/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: crawler }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "招聘配置保存失败");
      setCrawler(data.config);
      pushToast("招聘爬虫配置已保存", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "招聘配置保存失败", "error");
    } finally {
      setCrawlerBusy(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCrawler((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.includes(cat as never)
              ? prev.categories.filter((c) => c !== cat)
              : [...prev.categories, cat as never],
          }
        : prev
    );
  };

  const toggleSourceWhitelist = (id: string) => {
    setCrawler((prev) =>
      prev
        ? {
            ...prev,
            sources: prev.sources.includes(id)
              ? prev.sources.filter((s) => s !== id)
              : [...prev.sources, id],
          }
        : prev
    );
  };

  const updateHosts = async () => {
    setHostsBusy(true);
    try {
      const r = await fetch("/api/jobs/hosts/update", { method: "POST" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "hosts 更新失败");
      pushToast("hosts 更新已启动，稍后自动刷新", "success");
      window.setTimeout(() => void loadCrawlerData(), 2500);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "hosts 更新失败", "error");
    } finally {
      setHostsBusy(false);
    }
  };

  const saveSubscription = async (sub: {
    id?: number;
    name: string;
    categories: string[];
    keywords: string[];
    cities: string[];
    enabled?: boolean;
  }) => {
    try {
      const r = await fetch("/api/jobs/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: { ...sub, enabled: sub.enabled ?? true } }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "订阅保存失败");
      pushToast("订阅已保存", "success");
      const sr = await fetch("/api/jobs/subscriptions");
      const sd = (await sr.json()) as { subscriptions: JobSubscription[] };
      setSubscriptions(sd.subscriptions ?? []);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "订阅保存失败", "error");
    }
  };

  const removeSubscription = async (id: number) => {
    try {
      const r = await fetch(`/api/jobs/subscriptions/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "删除订阅失败");
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      pushToast("订阅已删除", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除订阅失败", "error");
    }
  };

  const runCrawler = async () => {
    setCrawlerRunBusy(true);
    try {
      const r = await fetch("/api/jobs/run", { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "启动抓取失败");
      pushToast("抓取已启动，稍后自动刷新", "success");
      window.setTimeout(() => loadCrawlerData(), 1800);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "启动抓取失败", "error");
    } finally {
      setCrawlerRunBusy(false);
    }
  };

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

  const changePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      setPwMsg("请填写完整");
      setPwOk(false);
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg("两次输入的新密码不一致");
      setPwOk(false);
      return;
    }
    if (pwNew.length < 6) {
      setPwMsg("新密码至少 6 位");
      setPwOk(false);
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    setPwOk(null);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await r.json();
      if (!r.ok) {
        setPwMsg(data.error ?? "修改失败");
        setPwOk(false);
      } else {
        setPwMsg("密码修改成功");
        setPwOk(true);
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
      }
    } catch {
      setPwMsg("网络异常，请稍后重试");
      setPwOk(false);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">设置</h1>
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">关闭后使用简洁渐变背景。</p>
              <Button variant="secondary" size="sm" onClick={refreshWallpaper} disabled={wallpaperBusy}>
                <RefreshCw className="size-3.5" /> {wallpaperBusy ? "刷新中…" : "刷新今日壁纸"}
              </Button>
            </div>
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
                浅色 / 深色 / 跟随壁纸
                {theme === "auto" ? `（当前：${autoTone === "dark" ? "深色" : "浅色"}）` : ""}
              </p>
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
              <Button
                variant={theme === "auto" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("auto")}
              >
                跟随壁纸
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
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flower2 className="size-5 text-emerald-500" />
            <CardTitle>招聘爬虫</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={runCrawler}
              disabled={crawlerRunBusy || crawlerBusy}
            >
              {crawlerRunBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              立即抓取
            </Button>
            <Button size="sm" onClick={saveCrawler} disabled={crawlerBusy}>
              {crawlerBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              保存配置
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">定时抓取开关</p>
              <p className="text-xs text-muted-foreground">关闭后暂停每日自动抓取，不影响手动运行</p>
            </div>
            <Switch
              checked={crawler?.enabled ?? false}
              onCheckedChange={(checked) => setCrawler((prev) => (prev ? { ...prev, enabled: checked } : prev))}
            />
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
            <span className="text-xs font-medium text-muted-foreground">抓取类别（考公考编 / 央国企官方源）</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {allJobCategories.map((cat) => {
                const active = crawler?.categories.includes(cat) ?? false;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={
                      active
                        ? "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                        : "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/15"
                    }
                  >
                    {jobCategoryLabels[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ChipEditor
              label="关键词"
              placeholder="如 网络工程师"
              items={crawler?.keywords ?? []}
              onAdd={(value) => setCrawler((prev) => prev && !prev.keywords.includes(value) ? { ...prev, keywords: [...prev.keywords, value] } : prev)}
              onRemove={(value) => setCrawler((prev) => prev ? { ...prev, keywords: prev.keywords.filter((item) => item !== value) } : prev)}
            />
            <ChipEditor
              label="行业"
              placeholder="如 通信"
              items={crawler?.industries ?? []}
              onAdd={(value) => setCrawler((prev) => prev && !prev.industries.includes(value) ? { ...prev, industries: [...prev.industries, value] } : prev)}
              onRemove={(value) => setCrawler((prev) => prev ? { ...prev, industries: prev.industries.filter((item) => item !== value) } : prev)}
            />
            <ChipEditor
              label="城市"
              placeholder="如 乌鲁木齐"
              items={crawler?.cities ?? []}
              onAdd={(value) => setCrawler((prev) => prev && !prev.cities.includes(value) ? { ...prev, cities: [...prev.cities, value] } : prev)}
              onRemove={(value) => setCrawler((prev) => prev ? { ...prev, cities: prev.cities.filter((item) => item !== value) } : prev)}
            />
          </div>

          <ChipEditor
            label="考编省份（省考 / 省直事业单位，可选）"
            placeholder="如 江苏"
            items={crawler?.provinces ?? []}
            onAdd={(value) => setCrawler((prev) => prev && !prev.provinces.includes(value) ? { ...prev, provinces: [...prev.provinces, value] } : prev)}
            onRemove={(value) => setCrawler((prev) => prev ? { ...prev, provinces: prev.provinces.filter((item) => item !== value) } : prev)}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
              <span className="text-xs font-medium text-muted-foreground">招聘平台</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(jobSourceLabels) as JobSource[]).map((source) => {
                  const active = crawler?.platforms.includes(source) ?? false;
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setCrawler((prev) => {
                        if (!prev) return prev;
                        const exists = prev.platforms.includes(source);
                        return {
                          ...prev,
                          platforms: exists ? prev.platforms.filter((p) => p !== source) : [...prev.platforms, source],
                        };
                      })}
                      className={
                        active
                          ? "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                          : "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/15"
                      }
                    >
                      {jobSourceLabels[source]}
                      {experimentalJobSources.includes(source) ? <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">实验</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
              <span className="text-xs font-medium text-muted-foreground">每日抓取时间</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="time"
                  value={crawler?.scheduleTime ?? "08:00"}
                  onChange={(e) => setCrawler((prev) => (prev ? { ...prev, scheduleTime: e.target.value } : prev))}
                  className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-emerald-500/60"
                />
                <span className="text-xs text-muted-foreground">每天自动抓取一次</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">信息源（hosts 注册表驱动）</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  v{hostsMeta?.version ?? 0}
                  {hostsMeta?.updatedAt ? " · " + formatRelativeTime(hostsMeta.updatedAt) : " · 未更新"}
                </span>
                <Button variant="outline" size="sm" onClick={updateHosts} disabled={hostsBusy}>
                  {hostsBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  更新 hosts
                </Button>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {sources.map((src) => {
                const active = crawler?.sources?.length ? crawler.sources.includes(src.id) : src.enabled;
                const rate = Math.round((src.hitRate ?? 1) * 100);
                return (
                  <div
                    key={src.id}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSourceWhitelist(src.id)}
                      aria-label={"切换 " + src.name}
                      className={"flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors " + (active ? "bg-emerald-500" : "bg-white/20")}
                    >
                      <span className={"size-3 rounded-full bg-white transition-transform " + (active ? "translate-x-3" : "")} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">{src.name}</span>
                        <Badge variant={src.risk === "L1" ? "success" : src.risk === "L2" ? "accent" : "muted"} className="text-[9px]">
                          {src.risk === "L3" ? "实验" : "官方"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500" style={{ width: rate + "%" }} />
                        </div>
                        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{rate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sources.length === 0 ? (
                <p className="col-span-full text-center text-xs text-muted-foreground">暂无信息源，请先「更新 hosts」</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-md">
            <span className="text-muted-foreground">上次运行</span>
            <span className="font-semibold text-foreground">
              {jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "尚未运行"}
            </span>
            {jobStats?.lastRunStatus ? (
              <Badge variant={jobStats.lastRunStatus === "failed" ? "muted" : "success"}>
                {jobStats.lastRunStatus}
              </Badge>
            ) : null}
            {crawler?.lastRunAt ? (
              <span className="ml-auto text-xs text-muted-foreground">配置最近运行：{formatRelativeTime(crawler.lastRunAt)}</span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold text-muted-foreground">最近运行日志</span>
              <Badge variant="muted">最多 10 条</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-y border-white/10 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">时间</th>
                    <th className="px-4 py-2 font-medium">平台</th>
                    <th className="px-4 py-2 font-medium">抓取</th>
                    <th className="px-4 py-2 font-medium">新增</th>
                    <th className="px-4 py-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRuns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">暂无运行日志</td>
                    </tr>
                  ) : (
                    jobRuns.slice(0, 10).map((run) => {
                      const platformText = Object.entries(run.platformsResult ?? {})
                        .map(([key, count]) => {
                          const label = jobSourceLabels[key as JobSource] ?? key;
                          return `${label} ${count}`;
                        })
                        .join(" / ") || "—";
                      const statusLabel =
                        run.status === "running"
                          ? "运行中"
                          : run.status === "success"
                            ? "成功"
                            : run.status === "partial"
                              ? "部分成功"
                              : "失败";
                      return (
                        <tr key={run.id} className="border-t border-white/5">
                          <td className="px-4 py-2 text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{platformText}</td>
                          <td className="px-4 py-2 tabular-nums text-foreground">{run.fetchedCount}</td>
                          <td className="px-4 py-2 tabular-nums text-emerald-600 dark:text-emerald-300">{run.newCount}</td>
                          <td className="px-4 py-2">
                            <Badge variant={run.status === "failed" ? "muted" : run.status === "running" ? "accent" : "success"}>
                              {statusLabel}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Bell className="size-5 text-primary" />
          <CardTitle>订阅提醒</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            按「央国企 × 北京 / 考编 × 计算机类」等条件订阅，抓取到新职位/公告时在招花页铃铛提醒
          </p>
          {subscriptions.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-muted-foreground">
              还没有订阅，点击下方按钮创建第一个
            </p>
          ) : (
            subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <Heart className="size-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{sub.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {sub.categories.length ? sub.categories.map((c) => jobCategoryLabels[c as never] ?? c).join(" / ") : "全类别"}
                    {sub.cities.length ? " · " + sub.cities.join(" / ") : ""}
                    {sub.keywords.length ? " · 关键词：" + sub.keywords.join("、") : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeSubscription(sub.id)}
                  aria-label="删除订阅"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
          <NewSubscriptionForm
            onSave={async (sub) => {
              await saveSubscription(sub);
            }}
          />
        </CardContent>
      </Card>

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
              placeholder="新密码（至少 6 位）"
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
          {pwMsg ? (
            <p className={`text-xs ${pwOk ? "text-success" : "text-danger"}`}>{pwMsg}</p>
          ) : null}
          <Button onClick={changePassword} disabled={pwBusy} className="self-end">
            <KeyRound className="size-4" /> {pwBusy ? "提交中…" : "保存新密码"}
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
}



"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  resumeAssetKindLabels,
  jobApplicationStageLabels,
  type ResumeAsset,
  type ResumeAssetKind,
  type JobApplication,
} from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  FileText,
  type LucideIcon,
  GraduationCap,
  FolderGit2,
  GitBranch,
  Award,
  Plus,
  Pencil,
  Trash2,
  Check,
  Copy,
  Download,
  RefreshCw,
  Briefcase,
  ExternalLink,
  Sparkles,
} from "lucide-react";

const KIND_ORDER: ResumeAssetKind[] = ["skill", "project", "github", "certificate"];
const KIND_LABEL = resumeAssetKindLabels;
const KIND_ICON: Record<ResumeAssetKind, LucideIcon> = {
  skill: GraduationCap,
  project: FolderGit2,
  github: GitBranch,
  certificate: Award,
};
const KIND_COLOR: Record<ResumeAssetKind, string> = {
  skill: "text-primary",
  project: "text-emerald-500",
  github: "text-foreground",
  certificate: "text-sky-500",
};
const KIND_HINT: Record<ResumeAssetKind, string> = {
  skill: "如：Linux / Docker / 云计算",
  project: "如：网络巡检助手",
  github: "如：learn-workbench（可填链接）",
  certificate: "如：HCIP-Datacom",
};

export default function CareerResumePage() {
  const [records, setRecords] = useState<ResumeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<{ displayName: string | null } | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [appError, setAppError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<ResumeAssetKind>("skill");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", content: "", url: "" });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/resume-assets");
      if (!r.ok) throw new Error("load failed");
      const d = await r.json();
      setRecords(d.records ?? []);
      setError(null);
    } catch {
      setError("简历资产加载失败，请确认数据库已启动");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setMe(d.user);
      })
      .catch(() => {});
    // 联动：投递记录（需要登录）
    fetch("/api/jobs/applications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setApplications(d.applications ?? []);
          setAppError(null);
        } else {
          setAppError("登录后可关联投递记录");
        }
      })
      .catch(() => setAppError("投递记录加载失败"));
  }, [load]);

  const openCreate = (kind: ResumeAssetKind) => {
    setFormKind(kind);
    setEditingId(null);
    setForm({ title: "", content: "", url: "" });
    setShowForm(true);
  };

  const openEdit = (rec: ResumeAsset) => {
    setFormKind(rec.kind);
    setEditingId(rec.id);
    setForm({ title: rec.title, content: rec.content ?? "", url: rec.url ?? "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      kind: formKind,
      title: form.title.trim(),
      content: form.content.trim() || null,
      url: form.url.trim() || null,
    };
    if (editingId) {
      await fetch("/api/resume-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      await fetch("/api/resume-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    load();
  };

  const del = async (id: number) => {
    await fetch(`/api/resume-assets?id=${id}`, { method: "DELETE" });
    load();
  };

  const buildMarkdown = () => {
    const name = me?.displayName || "我的简历";
    const lines: string[] = [`# ${name} 的简历`, ""];
    const byKind = (k: ResumeAssetKind) => records.filter((r) => r.kind === k);
    const sections: [string, ResumeAssetKind][] = [
      ["## 技能", "skill"],
      ["## 项目", "project"],
      ["## GitHub 项目", "github"],
      ["## 证书", "certificate"],
    ];
    for (const [header, kind] of sections) {
      const recs = byKind(kind);
      if (recs.length === 0) continue;
      lines.push(header);
      for (const r of recs) {
        const parts = [`**${r.title}**`];
        if (r.content) parts.push(r.content);
        if (r.url) parts.push(`(${r.url})`);
        lines.push(`- ${parts.join("：")}`);
      }
      lines.push("");
    }
    if (!records.length) lines.push("_尚未添加简历资产。_");
    return lines.join("\n");
  };

  const downloadMd = () => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${me?.displayName || "我的"}-简历.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      setToast("已复制 Markdown");
    } catch {
      setToast("复制失败，请手动选择");
    }
    window.setTimeout(() => setToast(null), 1800);
  };

  const syncSkills = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (r.ok) {
        const d = await r.json();
        setSyncMsg(`已同步 ${d.added ?? 0} 项技能到技能树`);
      } else if (r.status === 401) {
        setSyncMsg("同步到技能树需要登录后使用");
      } else {
        setSyncMsg("同步失败，请稍后再试");
      }
    } catch {
      setSyncMsg("同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const getRecords = (k: ResumeAssetKind) => records.filter((r) => r.kind === k);

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
        </Button>
        <h1 className="page-title text-2xl font-bold tracking-tight">简历</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPreviewOpen((v) => !v)}>
            <FileText className="size-4" /> {previewOpen ? "收起预览" : "预览简历"}
          </Button>
          <Button size="sm" onClick={downloadMd}>
            <Download className="size-4" /> 导出 Markdown
          </Button>
        </div>
      </div>
      <p className="page-subtitle mt-1 text-sm">技能 / 项目 / GitHub / 证书 → 简历预览与导出 → 投递记录联动</p>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {toast ? (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-sm text-success backdrop-blur-md">{toast}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 资产四栏 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {KIND_ORDER.map((kind) => {
              const Icon = KIND_ICON[kind];
              const recs = getRecords(kind);
              return (
                <Card key={kind}>
                  <CardHeader className="flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("size-5", KIND_COLOR[kind])} />
                      <CardTitle>{KIND_LABEL[kind]}</CardTitle>
                      <Badge variant="muted">{recs.length}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openCreate(kind)} aria-label={`添加${KIND_LABEL[kind]}`}>
                      <Plus className="size-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {recs.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">还没有{KIND_LABEL[kind]}资产</p>
                    ) : (
                      recs.map((r) => (
                        <div key={r.id} className="flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                            {r.content ? <p className="truncate text-xs text-muted-foreground">{r.content}</p> : null}
                            {r.url ? (
                              <a href={r.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-accent hover:underline">
                                <ExternalLink className="size-3" /> 链接
                              </a>
                            ) : null}
                          </div>
                          <button onClick={() => openEdit(r)} aria-label="编辑" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={() => del(r.id)} aria-label="删除" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {showForm ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = KIND_ICON[formKind];
                    return <Icon className={cn("size-5", KIND_COLOR[formKind])} />;
                  })()}
                  <CardTitle>{editingId ? "编辑" : "添加"}{KIND_LABEL[formKind]}</CardTitle>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  {KIND_ORDER.map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setFormKind(kind)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs transition-all",
                        formKind === kind ? "border-primary/60 bg-primary/10 text-primary" : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15"
                      )}
                    >
                      {KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={KIND_HINT[formKind]}
                  aria-label="名称"
                  className="h-10"
                />
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="一句话说明 / 亮点（可选）"
                  className="min-h-[72px] w-full resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
                />
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="链接（可选）"
                  aria-label="链接"
                  className="h-10"
                />
                <Button onClick={save} disabled={!form.title.trim()} className="self-end">
                  <Check className="size-4" /> 保存
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* 右侧：预览 + 联动 */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <FileText className="size-5 text-accent" />
              <CardTitle>简历预览</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {previewOpen ? (
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/15 bg-black/30 p-4 text-xs leading-relaxed text-foreground">
                  {buildMarkdown()}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">点击「预览简历」查看 Markdown 版简历</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={copyMd} disabled={records.length === 0}>
                  <Copy className="size-4" /> 复制
                </Button>
                <Button size="sm" variant="secondary" onClick={downloadMd} disabled={records.length === 0}>
                  <Download className="size-4" /> 下载 .md
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">粘贴到任意 Markdown 编辑器 / 简历工具即可继续排版。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <CardTitle>联动</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-primary" />
                  <span>同步技能 → 技能树</span>
                </div>
                <Button size="sm" variant="secondary" onClick={syncSkills} disabled={syncing}>
                  <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> {syncing ? "同步中…" : "同步"}
                </Button>
              </div>
              {syncMsg ? <p className="text-xs text-muted-foreground">{syncMsg}</p> : null}

              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <Briefcase className="size-4 text-emerald-500" />
                  <span className="font-medium">投递记录</span>
                  <Badge variant="muted">{applications.length}</Badge>
                </div>
                {appError ? (
                  <p className="text-xs text-muted-foreground">{appError}</p>
                ) : applications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">还没有投递记录，去「我的求职」添加。</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1">
                    {applications.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-foreground">{a.jobCompany} · {a.jobTitle}</span>
                        <span className="shrink-0 text-muted-foreground">{jobApplicationStageLabels[a.stage] ?? a.stage}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/career/applications" className="text-xs text-accent hover:underline">
                  管理投递记录 →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {loading && !records.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
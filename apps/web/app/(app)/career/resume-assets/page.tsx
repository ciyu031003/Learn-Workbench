"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ResumeAsset, ResumeAssetKind, JobApplication } from "@learn-workbench/shared/schemas";
import { resumeAssetKindLabels, jobApplicationStageLabels } from "@learn-workbench/shared/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
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
  project: "text-chart-2",
  github: "text-text-primary",
  certificate: "text-chart-8",
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
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="简历资产"
        description="技能 / 项目 / GitHub / 证书 → 简历编辑器与导出 → 投递记录联动"
        icon={<FolderGit2 className="size-5 text-primary" />}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/career/resume"><FileText className="size-4" /> 简历编辑器</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPreviewOpen((v) => !v)}>
              <FileText className="size-4" /> {previewOpen ? "收起预览" : "预览简历"}
            </Button>
            <Button size="sm" onClick={downloadMd}>
              <Download className="size-4" /> 导出 Markdown
            </Button>
          </>
        }
      />

      {error ? (
        <section className="rounded-3xl border border-danger/30 bg-danger/10 p-6 text-body-medium text-danger">{error}</section>
      ) : null}

      {toast ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-2 text-body-medium text-success backdrop-blur-md">{toast}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* 资产四栏 */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {KIND_ORDER.map((kind) => {
              const Icon = KIND_ICON[kind];
              const recs = getRecords(kind);
              return (
                <section key={kind} className="flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
                  <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("size-5 shrink-0", KIND_COLOR[kind])} />
                      <h2 className="truncate text-headline-medium text-text-primary">{KIND_LABEL[kind]}</h2>
                      <Badge variant="muted">{recs.length}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openCreate(kind)} aria-label={`添加${KIND_LABEL[kind]}`}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="px-4 pb-4">
                    {recs.length === 0 ? (
                      <p className="py-3 text-center text-caption-1-medium text-muted-foreground">还没有{KIND_LABEL[kind]}资产</p>
                    ) : (
                      <ScrollFade className={recs.length > 3 ? "h-[300px]" : ""}>
                        <div className="flex flex-col gap-2 pe-1">
                          {recs.map((r) => (
                            <div key={r.id} className="flex items-start gap-2 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-body-medium text-text-primary">{r.title}</p>
                                {r.content ? <p className="truncate text-caption-1-medium text-muted-foreground">{r.content}</p> : null}
                                {r.url ? (
                                  <a href={r.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-caption-1-medium text-accent hover:underline">
                                    <ExternalLink className="size-3" /> 链接
                                  </a>
                                ) : null}
                              </div>
                              <button onClick={() => openEdit(r)} aria-label="编辑" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background-tertiary-default hover:text-text-primary">
                                <Pencil className="size-3.5" />
                              </button>
                              <button onClick={() => del(r.id)} aria-label="删除" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger">
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </ScrollFade>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {showForm ? (
            <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = KIND_ICON[formKind];
                    return <Icon className={cn("size-5", KIND_COLOR[formKind])} />;
                  })()}
                  <h2 className="text-headline-medium text-text-primary">{editingId ? "编辑" : "添加"}{KIND_LABEL[formKind]}</h2>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
              </div>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="grid gap-2 sm:grid-cols-4">
                  {KIND_ORDER.map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setFormKind(kind)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-caption-1-medium transition-all",
                        formKind === kind
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border-button-default bg-background-primary-default text-muted-foreground hover:bg-background-secondary-hover"
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
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="一句话说明 / 亮点（可选）"
                  rows={2}
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
              </div>
            </section>
          ) : null}
        </div>

        {/* 右侧：预览 + 联动 */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
                <FileText className="size-4 text-accent" />
              </span>
              <h2 className="text-headline-medium text-text-primary">简历预览</h2>
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4">
              {previewOpen ? (
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-border-button-default bg-background-tertiary-default p-4 text-caption-1-medium leading-relaxed text-text-primary">
                  {buildMarkdown()}
                </pre>
              ) : (
                <p className="text-body-medium text-muted-foreground">点击「预览简历」查看 Markdown 版简历</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={copyMd} disabled={records.length === 0}>
                  <Copy className="size-4" /> 复制
                </Button>
                <Button size="sm" variant="secondary" onClick={downloadMd} disabled={records.length === 0}>
                  <Download className="size-4" /> 下载 .md
                </Button>
              </div>
              <p className="text-caption-1-medium text-muted-foreground">粘贴到任意 Markdown 编辑器 / 简历工具即可继续排版。</p>
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
                <Sparkles className="size-4 text-primary" />
              </span>
              <h2 className="text-headline-medium text-text-primary">联动</h2>
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4 text-body-medium">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-primary" />
                  <span className="text-text-primary">同步技能 → 技能树</span>
                </div>
                <Button size="sm" variant="secondary" onClick={syncSkills} disabled={syncing}>
                  <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> {syncing ? "同步中…" : "同步"}
                </Button>
              </div>
              {syncMsg ? <p className="text-caption-1-medium text-muted-foreground">{syncMsg}</p> : null}

              <div className="rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <Briefcase className="size-4 text-chart-2" />
                  <span className="font-medium text-text-primary">投递记录</span>
                  <Badge variant="muted">{applications.length}</Badge>
                </div>
                {appError ? (
                  <p className="text-caption-1-medium text-muted-foreground">{appError}</p>
                ) : applications.length === 0 ? (
                  <p className="text-caption-1-medium text-muted-foreground">还没有投递记录，去「我的求职」添加。</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1">
                    {applications.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-caption-1-medium">
                        <span className="truncate text-text-primary">{a.jobCompany} · {a.jobTitle}</span>
                        <span className="shrink-0 text-muted-foreground">{jobApplicationStageLabels[a.stage] ?? a.stage}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/career/applications" className="text-caption-1-medium text-accent hover:underline">
                  管理投递记录 →
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      {loading && !records.length ? (
        <section className="rounded-3xl border border-border-button-default bg-background-secondary-default p-6 text-body-medium text-muted-foreground">
          加载中…
        </section>
      ) : null}
    </div>
  );
}

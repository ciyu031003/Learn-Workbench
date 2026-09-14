"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RESUME_TEMPLATES,
  getResumeTemplate,
  resumeSectionKeyLabels,
  resumeStyleSchema,
  type ResumeContent,
  type ResumeSectionConfig,
  type ResumeStyle,
} from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { ResumePreview } from "@/components/resume/resume-preview";
import { useToastStore } from "@/store/toast-store";
import {
  Plus, Printer, Save, Trash2, GripVertical, FileText, LayoutTemplate,
  ChevronUp, ChevronDown, EyeOff, Eye, Loader2, FolderGit2,
} from "lucide-react";

interface DocListItem {
  id: number;
  title: string;
  templateKey: string;
  isDefault: boolean;
  updatedAt: string;
}

interface DocState {
  id: number;
  title: string;
  templateKey: string;
  sectionOrder: ResumeSectionConfig[];
  styles: ResumeStyle;
}

const STYLE_DEFAULTS: ResumeStyle = resumeStyleSchema.parse({});
const ACCENT_PRESETS = ["#2f74c0", "#0f766e", "#7c3aed", "#b45309", "#334155", "#be123c"];

export default function ResumeEditorPage() {
  const pushToast = useToastStore((s) => s.push);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [doc, setDoc] = useState<DocState | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);

  /** 载入列表；无文档时自动创建一个默认文档（首次进入即可编辑） */
  const loadList = useCallback(async (): Promise<DocListItem[]> => {
    const r = await fetch("/api/resumes");
    if (!r.ok) throw new Error("简历列表加载失败");
    const d = await r.json();
    const list: DocListItem[] = Array.isArray(d.documents) ? d.documents : [];
    if (list.length === 0) {
      const cr = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "我的简历" }),
      });
      if (!cr.ok) throw new Error("创建简历失败");
      const cd = await cr.json();
      return [cd.document];
    }
    return list;
  }, []);

  const loadDoc = useCallback(async (id: number) => {
    const r = await fetch(`/api/resumes/${id}`);
    if (!r.ok) throw new Error("简历加载失败");
    const d = await r.json();
    const tpl = getResumeTemplate(d.document?.templateKey);
    setDoc({
      id: d.document.id,
      title: d.document.title ?? "我的简历",
      templateKey: tpl.key,
      sectionOrder: Array.isArray(d.document.sectionOrder) ? d.document.sectionOrder : [],
      styles: { ...STYLE_DEFAULTS, ...tpl.defaults, ...(d.document.styles ?? {}) } as ResumeStyle,
    });
    setContent(d.content ?? null);
    setDirty(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await loadList();
        if (!alive) return;
        setDocs(list);
        await loadDoc(list[0].id);
      } catch (e) {
        if (alive) pushToast(e instanceof Error ? e.message : "加载失败", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadList, loadDoc, pushToast]);

  const save = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/resumes/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: doc.title,
          templateKey: doc.templateKey,
          sectionOrder: doc.sectionOrder,
          styles: doc.styles,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      setDirty(false);
      pushToast("已保存");
      setDocs((prev) => prev.map((x) => (x.id === doc.id ? { ...x, title: doc.title, templateKey: doc.templateKey } : x)));
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const createDoc = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `我的简历 ${docs.length + 1}` }),
      });
      if (!r.ok) throw new Error("创建失败");
      const d = await r.json();
      const list = await loadList();
      setDocs(list);
      await loadDoc(d.document.id);
      pushToast("已新建简历");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "创建失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async () => {
    if (!doc) return;
    if (!window.confirm(`删除简历「${doc.title}」？`)) return;
    try {
      const r = await fetch(`/api/resumes/${doc.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      const list = await loadList();
      setDocs(list);
      await loadDoc(list[0].id);
      pushToast("已删除");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除失败", "error");
    }
  };

  const patchDoc = (p: Partial<DocState>) => {
    setDoc((s) => (s ? { ...s, ...p } : s));
    setDirty(true);
  };

  const toggleSection = (i: number) => {
    if (!doc) return;
    const next = doc.sectionOrder.map((s, idx) => (idx === i ? { ...s, visible: !s.visible } : s));
    patchDoc({ sectionOrder: next });
  };

  const moveSection = (from: number, to: number) => {
    if (!doc) return;
    if (to < 0 || to >= doc.sectionOrder.length || from === to) return;
    const next = [...doc.sectionOrder];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    patchDoc({ sectionOrder: next });
  };

  const changeTemplate = (key: string) => {
    if (!doc) return;
    const tpl = getResumeTemplate(key);
    // 切换模板时并入该模板默认样式（用户已改的 accent/fontScale 仍保留）
    patchDoc({ templateKey: tpl.key, styles: { ...doc.styles, ...tpl.defaults } as ResumeStyle });
  };

  const printResume = () => window.print();

  const stats = useMemo(() => {
    if (!content) return null;
    return {
      education: content.education.length,
      experience: content.experience.length,
      skills: content.skills.length,
      projects: content.projects.length,
      certificates: content.certificates.length,
    };
  }, [content]);

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> 正在准备简历编辑器…
      </div>
    );
  }

  if (!doc || !content) {
    return <EmptyState icon={FileText} title="暂时无法加载简历" hint="请稍后重试" />;
  }

  const tpl = getResumeTemplate(doc.templateKey);

  return (
    <div className="page-enter flex flex-col gap-5">
      {/* 顶部：文档切换 + 保存 + 导出 */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">简历编辑器</h1>
          <p className="page-subtitle mt-1 text-sm">
            多模板 · A4 实时预览 · 分节拖拽 · 打印导出（内容实时取自资料 / 证书 / 技能 / 资产）
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={doc.id}
            onChange={(e) => void loadDoc(Number(e.target.value))}
            className="h-9 rounded-xl border border-border bg-card/60 px-3 text-sm"
            aria-label="切换简历"
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={createDoc} disabled={busy} className="gap-1.5">
            <Plus className="size-4" /> 新建
          </Button>
          <Button size="sm" variant="ghost" onClick={removeDoc} disabled={busy || docs.length <= 1} className="gap-1.5 text-danger">
            <Trash2 className="size-4" /> 删除
          </Button>
          <Button size="sm" variant="secondary" onClick={printResume} className="gap-1.5">
            <Printer className="size-4" /> 打印 / 导出 PDF
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !dirty} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {dirty ? "保存" : "已保存"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        {/* 左：分节排序与开关 */}
        <Card className="h-fit print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">分节</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {doc.sectionOrder.map((s, i) => (
              <div
                key={s.key}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) moveSection(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition-colors ${
                  dragIndex === i ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/40 hover:bg-muted/50"
                }`}
              >
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                <span className={`min-w-0 flex-1 truncate ${s.visible ? "" : "text-muted-foreground line-through"}`}>
                  {resumeSectionKeyLabels[s.key]}
                </span>
                <button onClick={() => moveSection(i, i - 1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="上移">
                  <ChevronUp className="size-3.5" />
                </button>
                <button onClick={() => moveSection(i, i + 1)} disabled={i === doc.sectionOrder.length - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="下移">
                  <ChevronDown className="size-3.5" />
                </button>
                <button onClick={() => toggleSection(i)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={s.visible ? "隐藏" : "显示"}>
                  {s.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </div>
            ))}
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              拖动或上下箭头调整顺序；眼睛图标控制是否出现在简历中。
            </p>
            <div className="mt-2 border-t border-border/60 pt-3">
              <label className="mb-1 block text-xs font-medium">简历名称</label>
              <Input value={doc.title} onChange={(e) => patchDoc({ title: e.target.value })} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
              {stats ? (
                <>
                  <span>教育 {stats.education}</span>
                  <span>经历 {stats.experience}</span>
                  <span>技能 {stats.skills}</span>
                  <span>项目 {stats.projects}</span>
                  <span>证书 {stats.certificates}</span>
                </>
              ) : null}
            </div>
            <Link href="/career/resume-assets" className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline">
              <FolderGit2 className="size-3.5" /> 管理简历资产（技能 / 项目 / GitHub）
            </Link>
          </CardContent>
        </Card>

        {/* 中：A4 实时预览（刻意不做玻璃质感） */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
            <span>{tpl.name}</span>
            <span>·</span>
            <span>{doc.styles.page}</span>
            <div className="ml-2 flex items-center gap-1.5">
              {[0.55, 0.72, 0.9].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`rounded-md px-2 py-0.5 ${Math.abs(scale - s) < 0.01 ? "bg-primary/20 text-foreground" : "hover:bg-muted"}`}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
          </div>
          <div
            ref={previewRef}
            className="w-full overflow-auto rounded-2xl border border-border/60 bg-slate-200/40 p-4 print:overflow-visible print:border-0 print:bg-transparent print:p-0"
            style={{ maxHeight: "74vh" }}
          >
            <div style={{ height: 1123 * scale, width: "100%", display: "flex", justifyContent: "center" }}>
              <ResumePreview
                title={doc.title}
                templateKey={doc.templateKey}
                content={content}
                sectionOrder={doc.sectionOrder}
                styles={doc.styles}
                scale={scale}
              />
            </div>
          </div>
        </div>

        {/* 右：模板与样式 */}
        <div className="flex flex-col gap-4 print:hidden">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <LayoutTemplate className="size-4 text-primary" /> 模板
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {RESUME_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTemplate(t.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    doc.templateKey === t.key ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    {doc.templateKey === t.key ? <Badge variant="accent">使用中</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">样式</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div>
                <span className="mb-1.5 block font-medium">强调色</span>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchDoc({ styles: { ...doc.styles, accent: c } })}
                      className={`size-7 rounded-full border-2 ${doc.styles.accent === c ? "border-foreground" : "border-transparent"}`}
                      style={{ background: c }}
                      aria-label={`强调色 ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={doc.styles.accent}
                    onChange={(e) => patchDoc({ styles: { ...doc.styles, accent: e.target.value } })}
                    className="size-7 cursor-pointer rounded-full border border-border bg-transparent p-0"
                    aria-label="自定义强调色"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium">字号 {Math.round(doc.styles.fontScale * 100)}%</span>
                <input
                  type="range"
                  min={80}
                  max={130}
                  step={5}
                  value={Math.round(doc.styles.fontScale * 100)}
                  onChange={(e) => patchDoc({ styles: { ...doc.styles, fontScale: Number(e.target.value) / 100 } })}
                  className="w-full"
                />
              </div>

              <div>
                <span className="mb-1.5 block font-medium">行距</span>
                <div className="flex gap-1.5">
                  {(["compact", "normal", "relaxed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => patchDoc({ styles: { ...doc.styles, spacing: s } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.spacing === s ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"}`}
                    >
                      {s === "compact" ? "紧凑" : s === "normal" ? "标准" : "宽松"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium">字体</span>
                <div className="flex gap-1.5">
                  {(["sans", "serif"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => patchDoc({ styles: { ...doc.styles, fontFamily: f } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.fontFamily === f ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"}`}
                    >
                      {f === "sans" ? "无衬线" : "衬线"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium">页面</span>
                <div className="flex gap-1.5">
                  {(["A4", "Letter"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => patchDoc({ styles: { ...doc.styles, page: p } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.page === p ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 pt-1">
                <span className="font-medium">显示照片位</span>
                <Switch
                  checked={doc.styles.showPhoto}
                  onCheckedChange={(v) => patchDoc({ styles: { ...doc.styles, showPhoto: v } })}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
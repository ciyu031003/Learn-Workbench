"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ResumeFilesCard } from "@/components/resume/resume-files-card";
import { resumeStyleSchema } from "@learn-workbench/shared/schemas";
import type { ResumeContent, ResumeSectionConfig, ResumeStyle } from "@learn-workbench/shared/schemas";
import { RESUME_TEMPLATES, resumeSectionKeyLabels } from "@learn-workbench/shared/labels";
import { getResumeTemplate } from "@learn-workbench/shared/pure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="page-enter flex items-center justify-center py-24 text-body-medium text-muted-foreground">
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
      {/* 顶部：标题 + 文档切换 + 保存 + 导出（保留原操作按钮） */}
      <PageHeader
        title="简历编辑器"
        description="多模板 · A4 实时预览 · 分节拖拽 · 打印导出（内容实时取自资料 / 证书 / 技能 / 资产）"
        className="print:hidden"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={printResume} className="gap-1.5">
              <Printer className="size-4" /> 打印 / 导出 PDF
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !dirty} className="gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? "保存" : "已保存"}
            </Button>
          </>
        }
      />

      {/* v12 P2-2：用户上传的简历文件（PDF / Word ≤5MB，私有存储） */}
      <ResumeFilesCard />

      {/* 文档切换 / 新建 / 删除（保留原按钮，窄屏自然换行） */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          value={doc.id}
          onChange={(e) => void loadDoc(Number(e.target.value))}
          className="h-9 rounded-xl border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary"
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
      </div>


      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* 左：分节排序与开关 */}
        <section className="flex h-fit min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-secondary-default print:hidden">
          <div className="flex items-center gap-2 px-4 pb-2 pt-4">
            <h2 className="text-headline-medium text-text-primary">分节</h2>
          </div>
          <div className="flex flex-col gap-1.5 px-4 pb-4">
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
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-body-medium transition-colors ${
                  dragIndex === i ? "border-primary/60 bg-primary/10" : "border-border-button-default bg-background-primary-default hover:bg-background-secondary-hover"
                }`}
              >
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                <span className={`min-w-0 flex-1 truncate ${s.visible ? "text-text-primary" : "text-muted-foreground line-through"}`}>
                  {resumeSectionKeyLabels[s.key]}
                </span>
                <button onClick={() => moveSection(i, i - 1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-text-primary disabled:opacity-30" aria-label="上移">
                  <ChevronUp className="size-3.5" />
                </button>
                <button onClick={() => moveSection(i, i + 1)} disabled={i === doc.sectionOrder.length - 1} className="rounded p-1 text-muted-foreground hover:text-text-primary disabled:opacity-30" aria-label="下移">
                  <ChevronDown className="size-3.5" />
                </button>
                <button onClick={() => toggleSection(i)} className="rounded p-1 text-muted-foreground hover:text-text-primary" aria-label={s.visible ? "隐藏" : "显示"}>
                  {s.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </div>
            ))}
            <p className="mt-1 text-caption-1-medium leading-relaxed text-muted-foreground">
              拖动或上下箭头调整顺序；眼睛图标控制是否出现在简历中。
            </p>
            <div className="mt-2 border-t border-separator-border pt-3">
              <label className="mb-1 block text-caption-1-medium text-muted-foreground">简历名称</label>
              <Input value={doc.title} onChange={(e) => patchDoc({ title: e.target.value })} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-caption-1-medium text-muted-foreground">
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
            <Link href="/career/resume-assets" className="mt-2 flex items-center gap-1.5 text-caption-1-medium text-primary hover:underline">
              <FolderGit2 className="size-3.5" /> 管理简历资产（技能 / 项目 / GitHub）
            </Link>
          </div>
        </section>

        {/* 中：A4 实时预览（刻意不做玻璃质感） */}
        <div className="flex min-w-0 flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-caption-1-medium text-muted-foreground print:hidden">
            <span>{tpl.name}</span>
            <span>·</span>
            <span>{doc.styles.page}</span>
            <div className="ml-2 flex items-center gap-1.5">
              {[0.55, 0.72, 0.9].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`rounded-md px-2 py-0.5 ${Math.abs(scale - s) < 0.01 ? "bg-primary/20 text-text-primary" : "hover:bg-background-tertiary-default"}`}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
          </div>
          <div
            ref={previewRef}
            className="w-full overflow-auto rounded-3xl border border-border-button-default bg-background-tertiary-default p-4 print:overflow-visible print:border-0 print:bg-transparent print:p-0"
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
        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
                <LayoutTemplate className="size-4 text-primary" />
              </span>
              <h2 className="text-headline-medium text-text-primary">模板</h2>
            </div>
            <div className="flex flex-col gap-1.5 px-4 pb-4">
              {RESUME_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTemplate(t.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    doc.templateKey === t.key ? "border-primary/60 bg-primary/10" : "border-border-button-default bg-background-primary-default hover:bg-background-secondary-hover"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-medium text-text-primary">{t.name}</span>
                    {doc.templateKey === t.key ? <Badge variant="accent">使用中</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-caption-1-medium leading-snug text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-border-button-default bg-background-secondary-default">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <h2 className="text-headline-medium text-text-primary">样式</h2>
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4 text-caption-1-medium">
              <div>
                <span className="mb-1.5 block font-medium text-text-primary">强调色</span>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchDoc({ styles: { ...doc.styles, accent: c } })}
                      className={`size-7 rounded-full border-2 ${doc.styles.accent === c ? "border-text-primary" : "border-transparent"}`}
                      style={{ background: c }}
                      aria-label={`强调色 ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={doc.styles.accent}
                    onChange={(e) => patchDoc({ styles: { ...doc.styles, accent: e.target.value } })}
                    className="size-7 cursor-pointer rounded-full border border-border-button-default bg-transparent p-0"
                    aria-label="自定义强调色"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium text-text-primary">字号 {Math.round(doc.styles.fontScale * 100)}%</span>
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
                <span className="mb-1.5 block font-medium text-text-primary">行距</span>
                <div className="flex gap-1.5">
                  {(["compact", "normal", "relaxed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => patchDoc({ styles: { ...doc.styles, spacing: s } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.spacing === s ? "border-primary/60 bg-primary/15 text-text-primary" : "border-border-button-default hover:bg-background-secondary-hover"}`}
                    >
                      {s === "compact" ? "紧凑" : s === "normal" ? "标准" : "宽松"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium text-text-primary">字体</span>
                <div className="flex gap-1.5">
                  {(["sans", "serif"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => patchDoc({ styles: { ...doc.styles, fontFamily: f } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.fontFamily === f ? "border-primary/60 bg-primary/15 text-text-primary" : "border-border-button-default hover:bg-background-secondary-hover"}`}
                    >
                      {f === "sans" ? "无衬线" : "衬线"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block font-medium text-text-primary">页面</span>
                <div className="flex gap-1.5">
                  {(["A4", "Letter"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => patchDoc({ styles: { ...doc.styles, page: p } })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 ${doc.styles.page === p ? "border-primary/60 bg-primary/15 text-text-primary" : "border-border-button-default hover:bg-background-secondary-hover"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 pt-1">
                <span className="font-medium text-text-primary">显示照片位</span>
                <Switch
                  checked={doc.styles.showPhoto}
                  onCheckedChange={(v) => patchDoc({ styles: { ...doc.styles, showPhoto: v } })}
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
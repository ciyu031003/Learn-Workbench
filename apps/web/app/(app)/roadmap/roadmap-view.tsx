"use client";

import type { Dispatch, SetStateAction } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared/schemas";
import { pct } from "@learn-workbench/shared/dates";
import { Card, CardContent } from "@/components/ui/card";
import { GlassModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  FileText,
  FolderGit2,
  GripVertical,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import { DomainIcon, DOMAIN_ICONS } from "@/components/domain-icon";
import { MarkdownLite } from "@/components/md-lite";
import { DOMAIN_COLORS, KIND_OPTIONS, type DomainEditForm, type DomainRow, type DomainTemplate, type MdCounts, type MdPhasePreview, type PhaseForm, type Track } from "./roadmap-types";

/** RoadmapView 的 props：由 page 的状态/hooks 与展示层解耦后传入（拆分前都是同一作用域变量） */
export interface RoadmapViewProps {
  overall: number;
  phases: RoadmapPhase[];
  main: RoadmapPhase[];
  agent: RoadmapPhase[];
  canEdit: boolean;
  currentCareer: DomainRow | null;
  expanded: Record<number, boolean>;
  detail: Record<number, boolean>;
  adding: boolean;
  formPhase: string;
  formTitle: string;
  formSummary: string;
  mdOpen: boolean;
  mdText: string;
  mdInfo: { counts: MdCounts; preview: MdPhasePreview[] } | null;
  mdBusy: boolean;
  mdError: string | null;
  phaseModal: boolean;
  editingPhase: RoadmapPhase | null;
  phaseForm: PhaseForm;
  domainManager: boolean;
  domainCreator: boolean;
  domainEditor: DomainRow | null;
  editForm: DomainEditForm;
  domains: DomainRow[];
  templates: DomainTemplate[];
  archivedDomains: DomainRow[];
  archivedOpen: boolean;
  busy: boolean;
  career: string;
  dragId: number | null;
  dragOverId: number | null;
  setAdding: Dispatch<SetStateAction<boolean>>;
  setFormPhase: Dispatch<SetStateAction<string>>;
  setFormTitle: Dispatch<SetStateAction<string>>;
  setFormSummary: Dispatch<SetStateAction<string>>;
  setMdOpen: Dispatch<SetStateAction<boolean>>;
  setMdText: Dispatch<SetStateAction<string>>;
  setMdInfo: Dispatch<SetStateAction<{ counts: MdCounts; preview: MdPhasePreview[] } | null>>;
  setMdError: Dispatch<SetStateAction<string | null>>;
  setPhaseModal: Dispatch<SetStateAction<boolean>>;
  setPhaseForm: Dispatch<SetStateAction<PhaseForm>>;
  setDomainManager: Dispatch<SetStateAction<boolean>>;
  setDomainCreator: Dispatch<SetStateAction<boolean>>;
  setDomainEditor: Dispatch<SetStateAction<DomainRow | null>>;
  setEditForm: Dispatch<SetStateAction<DomainEditForm>>;
  setArchivedOpen: Dispatch<SetStateAction<boolean>>;
  openAddPhase: () => void;
  openEditPhase: (phase: RoadmapPhase) => void;
  savePhase: () => void;
  deletePhase: (phase: RoadmapPhase) => void;
  onPhaseDragStart: (e: ReactDragEvent, phase: RoadmapPhase) => void;
  onPhaseDragOver: (e: ReactDragEvent, phase: RoadmapPhase) => void;
  onPhaseDrop: (e: ReactDragEvent, track: Track) => void;
  onPhaseDragEnd: () => void;
  togglePhase: (id: number) => void;
  toggleTopic: (topicId: number, done: boolean) => void;
  toggleDetail: (id: number) => void;
  openDomainEditor: (d: DomainRow) => void;
  saveDomain: () => void;
  createDomain: (templateKey: string | null) => void;
  duplicateDomain: (d: DomainRow) => void;
  archiveDomain: (d: DomainRow) => void;
  deleteDomain: (d: DomainRow) => void;
  restoreDomain: (d: DomainRow) => void;
  deleteArchivedDomain: (d: DomainRow) => void;
  switchDomain: (key: string) => void;
  addCustom: () => void;
  deleteCustom: (topicId: number) => void;
  callImport: (dryRun: boolean) => Promise<void>;
  readMdFile: (file: File | undefined) => Promise<void>;
};

/**
 * 路线图展示层（S6-1 从 page.tsx 拆出）：只负责渲染，不直接发请求。
 * 数据/动作由 page 的 hooks 传入，行为与拆分前一致（DOM/类名逐字保留）。
 */
export function RoadmapView(props: RoadmapViewProps) {
  const {
    overall, phases, main, agent, canEdit, currentCareer, expanded, detail, adding, formPhase, formTitle, formSummary,
    mdOpen, mdText, mdInfo, mdBusy, mdError, phaseModal, editingPhase, phaseForm, domainManager, domainCreator, domainEditor,
    editForm, domains, templates, archivedDomains, archivedOpen, busy, career, dragId, dragOverId,
    setAdding, setFormPhase, setFormTitle, setFormSummary, setMdOpen, setMdText, setMdInfo, setMdError, setPhaseModal,
    setPhaseForm, setDomainManager, setDomainCreator, setDomainEditor, setEditForm, setArchivedOpen,
    openAddPhase, openEditPhase, savePhase, deletePhase, onPhaseDragStart, onPhaseDragOver, onPhaseDrop, onPhaseDragEnd,
    togglePhase, toggleTopic, toggleDetail, openDomainEditor, saveDomain, createDomain, duplicateDomain,
    archiveDomain, deleteDomain, restoreDomain, deleteArchivedDomain, switchDomain, addCustom, deleteCustom, callImport, readMdFile,
  } = props;

  return (
    <>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="text-2xl font-semibold">{overall}%</span>
              <Progress value={overall} className="flex-1" />
              <span className="text-sm text-muted-foreground">
                {phases.flatMap((p) => p.topics).filter((t) => t.done).length}/
                {phases.flatMap((p) => p.topics).length} 主题
              </span>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={openAddPhase}>
                    <Plus className="size-4" /> 添加大阶段
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                    <Plus className="size-4" /> 自定义主题
                  </Button>
                  {/* v6 P3-2：导入 Markdown 学习计划 */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMdInfo(null);
                      setMdError(null);
                      setMdOpen(true);
                    }}
                  >
                    <BookOpen className="size-4" /> 导入 MD
                  </Button>
                </div>
              ) : (
                <Badge variant="muted">{currentCareer?.name ?? "当前领域"} · 不可自定义</Badge>
              )}
            </CardContent>
          </Card>

          <GlassModal open={adding} onClose={() => setAdding(false)} title="添加自定义学习内容">
            <p className="mb-3 text-xs text-muted-foreground">选择要在哪个 P 阶段下添加学习主题</p>
            <div className="flex flex-col gap-3">
              <select
                value={formPhase}
                onChange={(e) => setFormPhase(e.target.value)}
                className="paper-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
              >
                <option value="">选择阶段…</option>
                {main.concat(agent).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.track === "main" ? `P${main.findIndex((x) => x.id === p.id) + 1}` : "Agent"} · {p.title}
                  </option>
                ))}
              </select>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="学习内容标题（必填）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="简要说明（可选）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
              <Button onClick={addCustom} disabled={!formPhase || !formTitle.trim()}>
                <Plus className="size-4" /> 添加
              </Button>
            </div>
          </GlassModal>

          {/* v6 P3-2：MD 导入（选文件或粘贴 → 预览 → 确认） */}
          <GlassModal open={mdOpen} onClose={() => setMdOpen(false)} title="导入 Markdown 学习计划">
            <p className="mb-3 text-xs text-muted-foreground">
              # 一级标题 = 学习阶段；## 二级 = 阶段里的主题；### 三级 = 主题下的学习内容（正文一起导入）。
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={(e) => void readMdFile(e.target.files?.[0])}
                className="text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-xs file:text-foreground"
              />
              <textarea
                value={mdText}
                onChange={(e) => {
                  setMdText(e.target.value);
                  setMdInfo(null);
                  setMdError(null);
                }}
                rows={8}
                placeholder="# 阶段一：基础&#10;## 主题 A&#10;### 学习内容 1&#10;具体说明…"
                className="rounded-xl border border-white/25 bg-white/12 px-3 py-2 font-mono text-xs text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            {mdError ? <p className="mt-2 text-xs text-danger">{mdError}</p> : null}
            {mdInfo ? (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-xl bg-white/10 p-3 text-xs">
                <p className="font-semibold text-primary">
                  {mdInfo.counts.phases} 个阶段 · {mdInfo.counts.topics} 个主题 · {mdInfo.counts.items} 条学习内容
                </p>
                {mdInfo.preview.slice(0, 8).map((p) => (
                  <p key={p.title} className="mt-1 text-foreground"># {p.title}</p>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMdOpen(false)}>取消</Button>
              <Button variant="secondary" onClick={() => void callImport(true)} disabled={mdBusy || !mdText.trim()}>
                预览
              </Button>
              <Button onClick={() => void callImport(false)} disabled={mdBusy || !mdInfo}>
                <Plus className="size-4" /> 确认导入
              </Button>
            </div>
          </GlassModal>
          {/* 新增/编辑大阶段 */}
          <GlassModal
            open={phaseModal}
            onClose={() => setPhaseModal(false)}
            title={editingPhase ? "编辑大阶段" : "添加大阶段"}
          >
            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">所属轨道</label>
              <select
                value={phaseForm.track}
                onChange={(e) => setPhaseForm((s) => ({ ...s, track: e.target.value as Track }))}
                className="paper-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
              >
                <option value="main">主线（P1/P2/…，自动编号）</option>
                <option value="agent">Agent 副线</option>
              </select>
              <input
                value={phaseForm.title}
                onChange={(e) => setPhaseForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="阶段名称（必填），如：数据库进阶实战"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={phaseForm.summary}
                onChange={(e) => setPhaseForm((s) => ({ ...s, summary: e.target.value }))}
                placeholder="阶段简介（可选）"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={phaseForm.weeks}
                onChange={(e) => setPhaseForm((s) => ({ ...s, weeks: e.target.value }))}
                placeholder="周期（可选），如：第 37-40 周"
                className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPhaseModal(false)}>取消</Button>
              <Button onClick={savePhase} disabled={!phaseForm.title.trim()}>
                <Plus className="size-4" /> {editingPhase ? "保存" : "添加"}
              </Button>
            </div>
          </GlassModal>
          {/* 领域管理 */}
          <GlassModal open={domainManager} onClose={() => setDomainManager(false)} title="学习领域">
            <div className="flex flex-col gap-2">
              {domains.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">暂无可见领域</p>
              ) : (
                domains.map((d) => {
                  const active = d.career_key === career;
                  const owned = !!d.owner_id;
                  return (
                    <div
                      key={d.career_key}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-white/15 bg-white/10 hover:bg-white/14"}`}
                    >
                      <button
                        onClick={() => {
                          switchDomain(d.career_key);
                          setDomainManager(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${d.color}26`, color: d.color }}
                        >
                          <DomainIcon icon={d.icon} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{d.name}</span>
                            <Badge variant={active ? "default" : "muted"}>{d.kind_label}</Badge>
                            {!owned ? <Badge variant="muted">内置</Badge> : null}
                          </span>
                          {d.description ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{d.description}</span>
                          ) : null}
                        </span>
                        {active ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : null}
                      </button>
                      {owned ? (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => openDomainEditor(d)}
                            aria-label={`编辑${d.name}`}
                            title="编辑"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => duplicateDomain(d)}
                            aria-label={`复制${d.name}`}
                            title="复制"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Copy className="size-4" />
                          </button>
                          <button
                            onClick={() => archiveDomain(d)}
                            aria-label={`归档${d.name}`}
                            title="归档"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Archive className="size-4" />
                          </button>
                          <button
                            onClick={() => deleteDomain(d)}
                            aria-label={`删除${d.name}`}
                            title="删除"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
              {archivedDomains.length > 0 ? (
                <>
                  <button
                    onClick={() => setArchivedOpen((s) => !s)}
                    className="mt-1 flex items-center justify-between rounded-xl px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>已归档（{archivedDomains.length}）</span>
                    {archivedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  {archivedOpen ? (
                    <div className="flex flex-col gap-2">
                      {archivedDomains.map((d) => (
                        <div
                          key={d.career_key}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 opacity-80"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${d.color}1f`, color: d.color }}
                          >
                            <DomainIcon icon={d.icon} className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{d.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">已归档 · 内容已保留</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() => restoreDomain(d)}
                              aria-label={`恢复${d.name}`}
                              title="恢复"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-success/15 hover:text-success"
                            >
                              <ArchiveRestore className="size-4" />
                            </button>
                            <button
                              onClick={() => deleteArchivedDomain(d)}
                              aria-label={`删除${d.name}`}
                              title="彻底删除"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="mt-1 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setDomainManager(false);
                    setDomainCreator(true);
                  }}
                  disabled={busy}
                >
                  <Plus className="size-4" /> 新建领域
                </Button>
              </div>
            </div>
          </GlassModal>

          {/* 新建领域：空白 / 模板 */}
          <GlassModal open={domainCreator} onClose={() => setDomainCreator(false)} title="新建学习领域">
            <p className="mb-3 text-xs text-muted-foreground">选择模板即可快速开始，或从空白领域完全自定义。</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => createDomain(null)}
                disabled={busy}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-left transition-colors hover:bg-white/14 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Plus className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">空白领域</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">从零搭建自己的学习路线：阶段、主题全部自定义</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
              {templates.map((t) => (
                <button
                  key={t.key}
                  onClick={() => createDomain(t.key)}
                  disabled={busy}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-left transition-colors hover:bg-white/14 disabled:opacity-60"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${t.color}26`, color: t.color }}
                  >
                    <DomainIcon icon={t.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="muted">{t.kindLabel}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.description}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.phaseCount} 阶段</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </GlassModal>

          {/* 编辑领域 */}
          <GlassModal
            open={!!domainEditor}
            onClose={() => setDomainEditor(null)}
            title={domainEditor ? `编辑「${domainEditor.name}」` : "编辑领域"}
          >
            {domainEditor ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">名称</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="领域名称（必填）"
                    className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">简介</label>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="一句话说明这个领域（可选）"
                    className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">图标</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(DOMAIN_ICONS).map((k) => (
                      <button
                        key={k}
                        onClick={() => setEditForm((s) => ({ ...s, icon: k }))}
                        aria-label={`图标 ${k}`}
                        title={k}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${editForm.icon === k ? "border-primary bg-primary/15 text-primary" : "border-white/15 bg-white/10 text-muted-foreground hover:text-foreground"}`}
                      >
                        <DomainIcon icon={k} className="size-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">颜色</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DOMAIN_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditForm((s) => ({ ...s, color: c }))}
                        aria-label={`颜色 ${c}`}
                        title={c}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${editForm.color === c ? "scale-110 border-white" : "border-white/20"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">阶段前缀</label>
                  <input
                    value={editForm.phasePrefix}
                    onChange={(e) => setEditForm((s) => ({ ...s, phasePrefix: e.target.value }))}
                    placeholder="如 P / E / S（1-3 位字母数字）"
                    className="h-10 rounded-xl border border-white/25 bg-white/12 px-3 text-sm text-foreground outline-none backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">领域类型</label>
                  <select
                    value={editForm.kind}
                    onChange={(e) => setEditForm((s) => ({ ...s, kind: e.target.value }))}
                    className="paper-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDomainEditor(null)}>取消</Button>
                  <Button onClick={saveDomain} disabled={busy || !editForm.name.trim()}>保存</Button>
                </div>
              </div>
            ) : null}
          </GlassModal>

          {main.length === 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/10 p-8 text-center text-sm text-muted-foreground">
              {canEdit ? "还没有大阶段，点击上方「添加大阶段」开始搭建这条路线。" : "这个领域还没有大阶段内容。"}
            </div>
          ) : null}
          {/* 主轨阶段 */}
          {main.map((phase, mainIndex) => {
            const doneCount = phase.topics.filter((t) => t.done).length;
            const percent = pct(doneCount, phase.topics.length);
            const isOpen = !!expanded[phase.id];
            return (
              <Card
                key={phase.id}
                id={`phase-${phase.id}`}
                draggable={canEdit}
                onDragStart={(e) => onPhaseDragStart(e, phase)}
                onDragOver={(e) => onPhaseDragOver(e, phase)}
                onDrop={(e) => onPhaseDrop(e, "main")}
                onDragEnd={onPhaseDragEnd}
                className={`roadmap-phase-card rise-in lift ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-primary/60" : ""}`}
              >
                <div className="flex items-center">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-5 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {`P${mainIndex + 1}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{phase.title}</span>
                        {phase.weeks ? <Badge variant="muted">{phase.weeks}</Badge> : null}
                        {phase.isCustom ? <Badge variant="accent">自定义</Badge> : null}
                      </span>
                      {phase.summary ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={phase.summary ?? undefined}>{phase.summary}</span>
                      ) : null}
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{doneCount}/{phase.topics.length}</span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </span>
                    {isOpen ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
                  </button>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-0.5 pr-3">
                      <span title="拖拽排序" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60">
                        <GripVertical className="size-4" />
                      </span>
                      <button onClick={() => openEditPhase(phase)} aria-label="编辑阶段" title="编辑阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => deletePhase(phase)} aria-label="删除阶段" title="删除阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {phase.topics.map((topic) => {
                        const isDetail = !!detail[topic.id];
                        return (
                          <div
                            key={topic.id}
                            className={`rounded-xl border ${topic.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <button
                                onClick={() => toggleTopic(topic.id, !topic.done)}
                                aria-label={topic.done ? "标记为未完成" : "标记为完成"}
                                className="shrink-0 rounded-lg p-2 -m-2"
                              >
                                {topic.done ? (
                                  <CheckCircle2 className="size-5 text-success" />
                                ) : (
                                  <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />
                                )}
                              </button>
                              <button
                                onClick={() => toggleDetail(topic.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className={`text-sm font-medium ${topic.done ? "text-muted-foreground line-through" : ""}`}>
                                  {topic.title}
                                </span>
                                {topic.agentTask ? (
                                  <span className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                                    <Sparkles className="size-3.5" /> {topic.agentTask}
                                  </span>
                                ) : null}
                              </button>
                              {topic.isCustom ? (
                                <Badge variant="accent">自定义</Badge>
                              ) : null}
                              {topic.isCustom ? (
                                <button
                                  onClick={() => deleteCustom(topic.id)}
                                  aria-label="删除自定义主题"
                                  className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-danger/15 hover:text-danger"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                              {isDetail ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                            </div>

                            {isDetail ? (
                              <div className="space-y-3 border-t border-border/40 px-3 py-3 text-sm">
                                {topic.summary ? <p className="text-muted-foreground">{topic.summary}</p> : null}

                                {topic.resources.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <BookOpen className="size-3.5" /> 资源
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {topic.resources.map((r) => (
                                        <Badge key={r.id} variant="outline">
                                          {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary">{r.name}</a> : r.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {topic.practices.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <Wrench className="size-3.5" /> 实操
                                    </p>
                                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                                      {topic.practices.map((p) => (
                                        <li key={p.id}>{p.text}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {topic.projects.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <FolderGit2 className="size-3.5" /> 项目 / 产出
                                    </p>
                                    <ul className="space-y-1.5">
                                      {topic.projects.map((p) => (
                                        <li key={p.id} className="rounded-lg bg-card px-3 py-2 shadow-sm">
                                          <span className="font-medium">{p.name}</span>
                                          {p.description ? <span className="ml-2 text-xs text-muted-foreground">{p.description}</span> : null}
                                          {p.deliverable ? (
                                            <span className="mt-0.5 block text-xs text-muted-foreground">产出：{p.deliverable}</span>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {topic.checkpoints.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <Target className="size-3.5" /> 验收标准
                                    </p>
                                    <ul className="space-y-1">
                                      {topic.checkpoints.map((c) => (
                                        <li key={c.id} className="flex items-start gap-1.5 text-muted-foreground">
                                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/60" />
                                          {c.text}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {topic.items && topic.items.length > 0 ? (
                                  <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <FileText className="size-3.5" /> 学习内容（{topic.items.length}）
                                    </p>
                                    <div className="space-y-3">
                                      {topic.items.map((item) => (
                                        <div key={item.id} className="rounded-lg bg-card px-3 py-2.5 shadow-sm">
                                          <p className="mb-1 font-medium text-foreground">{item.title}</p>
                                          <MarkdownLite markdown={item.contentMd} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
          {/* Agent 副线 */}
          {agent.map((phase) => {
            const doneCount = phase.topics.filter((t) => t.done).length;
            const percent = pct(doneCount, phase.topics.length);
            const isOpen = !!expanded[phase.id];
            return (
              <Card
                key={phase.id}
                draggable={canEdit}
                onDragStart={(e) => onPhaseDragStart(e, phase)}
                onDragOver={(e) => onPhaseDragOver(e, phase)}
                onDrop={(e) => onPhaseDrop(e, "agent")}
                onDragEnd={onPhaseDragEnd}
                className={`roadmap-phase-card rise-in lift border-accent/20 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-accent/60" : ""}`}
              >
                <div className="flex items-center">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-5 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Sparkles className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{phase.title}</span>
                        <Badge variant="accent">{phase.weeks}</Badge>
                        {phase.isCustom ? <Badge variant="accent">自定义</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={phase.summary ?? undefined}>{phase.summary}</span>
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{doneCount}/{phase.topics.length}</span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} indicatorClassName="progress-fill-accent" className="h-1.5" />
                    </span>
                    {isOpen ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
                  </button>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-0.5 pr-3">
                      <span title="拖拽排序" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60">
                        <GripVertical className="size-4" />
                      </span>
                      <button onClick={() => openEditPhase(phase)} aria-label="编辑阶段" title="编辑阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => deletePhase(phase)} aria-label="删除阶段" title="删除阶段" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {phase.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${topic.done ? "border-success/20 bg-success/5" : "border-border/60 bg-muted/30"}`}
                        >
                          <button onClick={() => toggleTopic(topic.id, !topic.done)} aria-label={topic.done ? "标记为未完成" : "标记为完成"} className="shrink-0 rounded-lg p-2 -m-2">
                            {topic.done ? (
                              <CheckCircle2 className="size-5 text-success" />
                            ) : (
                              <Circle className="size-5 text-muted-foreground/50 hover:text-primary" />
                            )}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${topic.done ? "text-muted-foreground line-through" : ""}`}>
                            {topic.title}
                          </span>
                          <span className="hidden text-xs text-muted-foreground sm:block">{topic.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
    </>
  );
}

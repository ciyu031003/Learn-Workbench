"use client";

import { useCallback, useEffect, useState } from "react";
import type { DragEvent as ReactDragEvent, SetStateAction } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared/schemas";
import { AsyncSection } from "@/components/async-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus } from "lucide-react";
import { DomainIcon } from "@/components/domain-icon";
import { parsePhaseHash, useDomains, useMarkdownImport, useRoadmapData } from "./roadmap-hooks";
import type { PhaseForm, Track } from "./roadmap-types";
import { RoadmapView } from "./roadmap-view";

/**
 * 学习路线图（S6-1 拆分后）：本文件只做编排 ——
 * - 数据/动作：useRoadmapData（阶段+勾选+排序+阶段 CRUD）与 useDomains（领域管理）；
 * - 展示：RoadmapView（原 page 的 JSX 逐字迁出）；
 * - 页面级 UI 状态：弹窗开关 / 表单 / 拖拽中状态。
 */
export default function RoadmapPage() {
  const domains = useDomains();
  const data = useRoadmapData(domains.career);
  const md = useMarkdownImport(domains.career, data.reload);

  // ---------- 页面级 UI 状态（弹窗/表单/拖拽） ----------
  const [adding, setAdding] = useState(false);
  const [formPhase, setFormPhase] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [phaseModal, setPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<RoadmapPhase | null>(null);
  const [phaseForm, setPhaseForm] = useState<PhaseForm>({ track: "main", title: "", summary: "", weeks: "" });

  // 从技能缺口等入口带 #phase-<id> 进入：展开并滚动定位到对应阶段
  const { phases, setExpanded } = data;
  useEffect(() => {
    if (!phases) return;
    const target = parsePhaseHash(window.location.hash);
    if (target === null) return;
    if (!phases.some((phase) => phase.id === target)) return;
    setExpanded((prev) => (prev[target] ? prev : { ...prev, [target]: true }));
    const timer = window.setTimeout(() => {
      document.getElementById("phase-" + target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [phases, setExpanded]);

  // ---------- 自定义主题 / 大阶段 ----------
  const addCustom = useCallback(async () => {
    const phaseId = Number(formPhase);
    if (!Number.isFinite(phaseId) || !formTitle.trim()) return;
    const ok = await data.addCustom(phaseId, formTitle, formSummary);
    if (!ok) return;
    setFormPhase("");
    setFormTitle("");
    setFormSummary("");
    setAdding(false);
  }, [formPhase, formTitle, formSummary, data]);

  const openAddPhase = useCallback(() => {
    setEditingPhase(null);
    setPhaseForm({ track: "main", title: "", summary: "", weeks: "" });
    setPhaseModal(true);
  }, []);

  const openEditPhase = useCallback((phase: RoadmapPhase) => {
    setEditingPhase(phase);
    setPhaseForm({
      track: phase.track,
      title: phase.title,
      summary: phase.summary ?? "",
      weeks: phase.weeks ?? "",
    });
    setPhaseModal(true);
  }, []);

  const savePhase = useCallback(async () => {
    const ok = await data.savePhase({
      id: editingPhase?.id,
      track: phaseForm.track,
      title: phaseForm.title,
      summary: phaseForm.summary.trim() || null,
      weeks: phaseForm.weeks.trim() || null,
    });
    if (ok) setPhaseModal(false);
  }, [data, editingPhase, phaseForm]);

  // ---------- 拖拽排序 ----------
  const canEdit = domains.canEdit;
  const onPhaseDragStart = useCallback((e: ReactDragEvent, phase: RoadmapPhase) => {
    if (!canEdit) return;
    setDragId(phase.id);
    e.dataTransfer.setData("text/plain", String(phase.id));
    e.dataTransfer.effectAllowed = "move";
  }, [canEdit]);

  const onPhaseDragOver = useCallback((e: ReactDragEvent, phase: RoadmapPhase) => {
    if (dragId == null || dragId === phase.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(phase.id);
  }, [dragId]);

  const onPhaseDrop = useCallback(async (e: ReactDragEvent, track: Track) => {
    e.preventDefault();
    const fromId = dragId;
    const toId = dragOverId;
    setDragId(null);
    setDragOverId(null);
    if (fromId == null || toId == null || fromId === toId) return;
    await data.reorder(track, fromId, toId);
  }, [dragId, dragOverId, data]);

  const onPhaseDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  // 打开导入弹窗前清空上一次的预览/错误（与拆分前一致）
  const openMd = useCallback((value: SetStateAction<boolean>) => {
    if (value === true) md.openMd();
    else md.setMdOpen(value);
  }, [md]);

  // 领域信息变更后刷新阶段展示（名称/前缀可能影响 P 编号）
  const saveDomain = useCallback(async () => {
    const ok = await domains.saveDomain();
    if (ok) await data.reload(true);
  }, [domains, data]);

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">学习路线图</h1>
          <p className="page-subtitle mt-1 text-sm">
            {domains.currentCareer ? domains.currentCareer.name + " · 主题完成即打勾，进度自动聚合" : "学习领域 · 主题完成即打勾，进度自动聚合"}
            {canEdit ? "（可编辑：拖动排序、增删/编辑阶段、添加主题）" : "（只读）"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={domains.openManager}
            aria-label="切换学习领域"
            title="切换 / 管理学习领域"
            className="flex h-10 max-w-60 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 text-sm backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-white/18 sm:max-w-72"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: (domains.currentCareer?.color ?? "#6366f1") + "26", color: domains.currentCareer?.color ?? "#6366f1" }}
            >
              <DomainIcon icon={domains.currentCareer?.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left font-medium">{domains.currentCareer?.name ?? "学习领域"}</span>
            {domains.currentCareer ? <Badge variant="muted" className="hidden shrink-0 sm:inline-flex">{domains.currentCareer.kind_label}</Badge> : null}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => domains.setDomainCreator(true)}>
            <Plus className="size-4" /> 新建
          </Button>
        </div>
      </div>

      {data.status === "error" ? (
        <AsyncSection status="error" errorMessage={data.error ?? "加载失败，请稍后重试"} onRetry={data.retry} />
      ) : data.status === "loading" || !data.phases ? (
        <AsyncSection status="loading" loadingLabel="正在加载路线图…" skeletonRows={4} />
      ) : data.phases.length === 0 ? (
        <AsyncSection
          status="empty"
          retryOnEmpty
          onRetry={data.retry}
          empty={canEdit ? "还没有大阶段，点击上方「添加大阶段」开始搭建这条路线。" : "这个领域还没有大阶段内容。"}
        />
      ) : (
        <RoadmapView
          overall={data.overall}
          phases={data.phases}
          main={data.main}
          agent={data.agent}
          canEdit={canEdit}
          currentCareer={domains.currentCareer}
          expanded={data.expanded}
          detail={data.detail}
          adding={adding}
          formPhase={formPhase}
          formTitle={formTitle}
          formSummary={formSummary}
          mdOpen={md.mdOpen}
          mdText={md.mdText}
          mdInfo={md.mdInfo}
          mdBusy={md.mdBusy}
          mdError={md.mdError}
          phaseModal={phaseModal}
          editingPhase={editingPhase}
          phaseForm={phaseForm}
          domainManager={domains.domainManager}
          domainCreator={domains.domainCreator}
          domainEditor={domains.domainEditor}
          editForm={domains.editForm}
          domains={domains.domains}
          templates={domains.templates}
          archivedDomains={domains.archivedDomains}
          archivedOpen={domains.archivedOpen}
          busy={domains.busy}
          career={domains.career}
          dragId={dragId}
          dragOverId={dragOverId}
          setAdding={setAdding}
          setFormPhase={setFormPhase}
          setFormTitle={setFormTitle}
          setFormSummary={setFormSummary}
          setMdOpen={openMd}
          setMdText={md.setMdText}
          setMdInfo={md.setMdInfo}
          setMdError={md.setMdError}
          setPhaseModal={setPhaseModal}
          setPhaseForm={setPhaseForm}
          setDomainManager={domains.setDomainManager}
          setDomainCreator={domains.setDomainCreator}
          setDomainEditor={domains.setDomainEditor}
          setEditForm={domains.setEditForm}
          setArchivedOpen={domains.setArchivedOpen}
          openAddPhase={openAddPhase}
          openEditPhase={openEditPhase}
          savePhase={savePhase}
          deletePhase={(phase) => { void data.deletePhase(phase); }}
          onPhaseDragStart={onPhaseDragStart}
          onPhaseDragOver={onPhaseDragOver}
          onPhaseDrop={onPhaseDrop}
          onPhaseDragEnd={onPhaseDragEnd}
          togglePhase={data.togglePhase}
          toggleTopic={(topicId, done) => { void data.toggleTopic(topicId, done); }}
          toggleDetail={data.toggleDetail}
          openDomainEditor={domains.openDomainEditor}
          saveDomain={() => { void saveDomain(); }}
          createDomain={(templateKey) => { void domains.createDomain(templateKey); }}
          duplicateDomain={domains.duplicateDomain}
          archiveDomain={domains.archiveDomain}
          deleteDomain={domains.deleteDomain}
          restoreDomain={domains.restoreDomain}
          deleteArchivedDomain={domains.deleteArchivedDomain}
          switchDomain={(key) => { void domains.switchDomain(key); }}
          addCustom={() => { void addCustom(); }}
          deleteCustom={(topicId) => { void data.deleteCustom(topicId); }}
          callImport={md.callImport}
          readMdFile={md.readMdFile}
        />
      )}
    </div>
  );
}

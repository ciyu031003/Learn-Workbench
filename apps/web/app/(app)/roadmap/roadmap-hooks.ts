"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared/schemas";
import { pct } from "@learn-workbench/shared/dates";
import { apiGet, apiMutate, ApiError, isAbortError } from "@/lib/client-api";
import type { SectionStatus } from "@/components/async-section";
import { toDomainIdentity } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import { useToastStore } from "@/store/toast-store";
import type {
  DomainEditForm,
  DomainRow,
  DomainTemplate,
  MdCounts,
  MdImportResponse,
  MdPhasePreview,
  Track,
} from "./roadmap-types";

// ============================================================================
// 纯函数（可单测，不依赖 React）
// ============================================================================

/** 已保存领域被归档/删除时，回退到第一个可见领域（无可用项则保留 ict 兜底） */
export function resolveCareerKey(
  list: ReadonlyArray<Pick<DomainRow, "career_key">>,
  saved: string | null | undefined
): string {
  const fallback = list[0]?.career_key ?? "ict";
  if (!saved) return fallback;
  return list.some((d) => d.career_key === saved) ? saved : fallback;
}

/** 勾选/取消主题的乐观更新（纯函数：返回新 phases，失败回滚用旧值） */
export function applyTopicDone(phases: RoadmapPhase[] | null, topicId: number, done: boolean): RoadmapPhase[] | null {
  if (!phases) return phases;
  return phases.map((phase) => ({
    ...phase,
    topics: phase.topics.map((topic) => (topic.id === topicId ? { ...topic, done } : topic)),
  }));
}

/** 整页完成度（主题维度，百分比取整） */
export function computeOverallPercent(phases: RoadmapPhase[] | null): number {
  if (!phases) return 0;
  const all = phases.flatMap((phase) => phase.topics);
  return pct(all.filter((topic) => topic.done).length, all.length);
}

/** 解析 #phase-<id> hash（技能缺口等入口深链），非该形式返回 null */
export function parsePhaseHash(hash: string): number | null {
  const m = hash.match(/^#phase-(\d+)$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** 同轨道拖拽排序：返回重排后的 phases 与提交给后端的 order；无效拖拽返回 null */
export function reorderTrackPhases(
  phases: RoadmapPhase[],
  track: Track,
  fromId: number,
  toId: number
): { ordered: RoadmapPhase[]; order: number[] } | null {
  const list = phases.filter((phase) => phase.track === track);
  const fromIdx = list.findIndex((phase) => phase.id === fromId);
  const toIdx = list.findIndex((phase) => phase.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  const byId = new Map(next.map((phase, i) => [phase.id, { ...phase, sortOrder: i }]));
  const ordered = phases.map((phase) =>
    phase.track === track && byId.has(phase.id) ? (byId.get(phase.id) as RoadmapPhase) : phase
  );
  return { ordered, order: next.map((phase) => phase.id) };
}

/** 默认展开前两个阶段（与拆分前 load() 行为一致） */
export function defaultExpanded(phases: ReadonlyArray<Pick<RoadmapPhase, "id">>, prev: Record<number, boolean>): Record<number, boolean> {
  const next = { ...prev };
  phases.forEach((phase, i) => {
    if (i < 2 && next[phase.id] === undefined) next[phase.id] = true;
  });
  return next;
}

// ============================================================================
// useRoadmapData：阶段数据 + 勾选/排序/阶段 CRUD（请求层统一走 client-api）
// ============================================================================

export function useRoadmapData(career: string) {
  const [phases, setPhases] = useState<RoadmapPhase[] | null>(null);
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [detail, setDetail] = useState<Record<number, boolean>>({});
  const pushToast = useToastStore((s) => s.push);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (careerKey: string, opts?: { silent?: boolean }) => {
    // 切页/切领域时取消上一个请求（修复 setState after unmount 警告）
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!opts?.silent) setStatus("loading");
    try {
      const data = await apiGet<{ phases?: RoadmapPhase[] }>(
        "/api/roadmap?career=" + encodeURIComponent(careerKey),
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const list = data?.phases ?? [];
      setPhases(list);
      setError(null);
      setStatus(list.length > 0 ? "ready" : "empty");
      setExpanded((prev) => defaultExpanded(list, prev));
    } catch (e) {
      if (isAbortError(e) || controller.signal.aborted) return;
      setError(e instanceof ApiError ? e.message : "加载失败，请稍后重试");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // 延迟到下一宏任务再触发：load 内部会同步 setState，直接在 effect body 调用会触发
    // react-hooks/set-state-in-effect（同 settings/content 页的既有写法）
    const timer = window.setTimeout(() => {
      void load(career);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [career, load]);

  const retry = useCallback(() => {
    void load(career);
  }, [career, load]);

  const reload = useCallback(
    async (silent = true) => {
      await load(career, { silent });
    },
    [career, load]
  );

  const togglePhase = useCallback((id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleDetail = useCallback((id: number) => {
    setDetail((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /** 勾选主题：乐观更新 -> 失败回滚 + toast（不再静默吞错） */
  const toggleTopic = useCallback(
    async (topicId: number, done: boolean) => {
      const snapshot = phases;
      setPhases(applyTopicDone(phases, topicId, done));
      try {
        await apiMutate("/api/progress", "POST", { topicId, done });
      } catch (e) {
        setPhases(snapshot);
        pushToast(e instanceof ApiError ? e.message : "更新失败，已回滚", "error");
      }
    },
    [phases, pushToast]
  );

  /** 拖拽排序：先本地换位，失败回滚 + toast，成功后静默刷新同步 P 编号 */
  const reorder = useCallback(
    async (track: Track, fromId: number, toId: number) => {
      if (!phases) return false;
      const result = reorderTrackPhases(phases, track, fromId, toId);
      if (!result) return false;
      const snapshot = phases;
      setPhases(result.ordered);
      try {
        await apiMutate("/api/roadmap/reorder", "POST", { career, track, order: result.order });
        await load(career, { silent: true });
        return true;
      } catch (e) {
        setPhases(snapshot);
        pushToast(e instanceof ApiError ? e.message : "排序保存失败", "error");
        return false;
      }
    },
    [phases, career, load, pushToast]
  );

  const addCustom = useCallback(
    async (phaseId: number, title: string, summary: string | null) => {
      if (!Number.isFinite(phaseId) || !title.trim()) return false;
      try {
        await apiMutate("/api/roadmap/custom", "POST", { phaseId, title: title.trim(), summary: summary?.trim() || null });
        await load(career, { silent: true });
        return true;
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "添加失败", "error");
        return false;
      }
    },
    [career, load, pushToast]
  );

  const deleteCustom = useCallback(
    async (topicId: number) => {
      try {
        await apiMutate("/api/roadmap/custom?topicId=" + topicId, "DELETE");
        await load(career, { silent: true });
        return true;
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "删除失败", "error");
        return false;
      }
    },
    [career, load, pushToast]
  );

  const savePhase = useCallback(
    async (input: { id?: number; track: Track; title: string; summary: string | null; weeks: string | null }) => {
      if (!input.title.trim()) return false;
      const payload = { career, track: input.track, title: input.title.trim(), summary: input.summary, weeks: input.weeks };
      try {
        if (input.id) {
          await apiMutate("/api/roadmap/phases", "PATCH", { ...payload, id: input.id });
        } else {
          await apiMutate("/api/roadmap/phases", "POST", payload);
        }
        await load(career, { silent: true });
        return true;
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "保存失败", "error");
        return false;
      }
    },
    [career, load, pushToast]
  );

  const deletePhase = useCallback(
    async (phase: RoadmapPhase) => {
      if (!window.confirm("确定删除大阶段「" + phase.title + "」？其下所有主题/内容将一并删除，此操作不可恢复。")) return false;
      try {
        await apiMutate("/api/roadmap/phases?id=" + phase.id, "DELETE");
        await load(career, { silent: true });
        return true;
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "删除失败", "error");
        return false;
      }
    },
    [career, load, pushToast]
  );

  const main = useMemo(() => phases?.filter((phase) => phase.track === "main") ?? [], [phases]);
  const agent = useMemo(() => phases?.filter((phase) => phase.track === "agent") ?? [], [phases]);
  const overall = useMemo(() => computeOverallPercent(phases), [phases]);

  return {
    phases,
    status,
    error,
    expanded,
    detail,
    setExpanded,
    setDetail,
    main,
    agent,
    overall,
    retry,
    reload,
    togglePhase,
    toggleDetail,
    toggleTopic,
    reorder,
    addCustom,
    deleteCustom,
    savePhase,
    deletePhase,
  };
}

export type RoadmapData = ReturnType<typeof useRoadmapData>;

// ============================================================================
// useDomains：领域列表/模板/归档 + 领域 CRUD（切换/新建/编辑/复制/归档/删除）
// ============================================================================

export function useDomains() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [templates, setTemplates] = useState<DomainTemplate[]>([]);
  const [career, setCareer] = useState("ict");
  const [busy, setBusy] = useState(false);
  const [domainManager, setDomainManager] = useState(false);
  const [domainCreator, setDomainCreator] = useState(false);
  const [domainEditor, setDomainEditor] = useState<DomainRow | null>(null);
  const [editForm, setEditForm] = useState<DomainEditForm>({ name: "", description: "", icon: "", color: "", phasePrefix: "", kind: "" });
  const [archivedDomains, setArchivedDomains] = useState<DomainRow[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const setDomain = useDomainStore((s) => s.setCurrent);
  const pushToast = useToastStore((s) => s.push);

  // 初始化：领域列表 + 模板 + 当前保存的领域；已归档/删除则回退到第一个可见领域
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [domainData, careerData] = await Promise.all([
          apiGet<{ domains?: DomainRow[]; templates?: DomainTemplate[] }>("/api/domains?templates=1", { signal: controller.signal }),
          apiGet<{ career?: string }>("/api/settings/career", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const list = domainData?.domains ?? [];
        setDomains(list);
        setTemplates(domainData?.templates ?? []);
        const resolved = resolveCareerKey(list, careerData?.career);
        setCareer(resolved);
        const row = list.find((d) => d.career_key === resolved);
        if (row) setDomain(toDomainIdentity(row));
      } catch (e) {
        // 领域接口不可用时保持默认 ICT（与拆分前一致：静默降级）
        if (!isAbortError(e)) return;
      }
    })();
    return () => controller.abort();
  }, [setDomain]);

  const refreshDomains = useCallback(async (): Promise<DomainRow[] | null> => {
    try {
      const data = await apiGet<{ domains?: DomainRow[]; templates?: DomainTemplate[] }>("/api/domains?templates=1");
      const list = data?.domains ?? [];
      setDomains(list);
      setTemplates(data?.templates ?? []);
      return list;
    } catch {
      return null;
    }
  }, []);

  const switchDomain = useCallback(
    async (key: string) => {
      setCareer(key);
      setDomains((prev) => {
        const row = prev.find((d) => d.career_key === key);
        if (row) setDomain(toDomainIdentity(row));
        return prev;
      });
      try {
        await apiMutate("/api/settings/career", "PUT", { career: key });
      } catch {
        // 保存失败不影响本次切换（与拆分前一致）
      }
    },
    [setDomain]
  );

  const ensureActive = useCallback(
    async (list: DomainRow[] | null) => {
      if (!list) return;
      if (list.some((d) => d.career_key === career)) return;
      const next = list[0]?.career_key;
      if (next && next !== career) {
        pushToast("已切换到「" + (list[0]?.name ?? next) + "」");
        await switchDomain(next);
      }
    },
    [career, pushToast, switchDomain]
  );

  const openDomainEditor = useCallback((d: DomainRow) => {
    setDomainEditor(d);
    setEditForm({
      name: d.name,
      description: d.description ?? "",
      icon: d.icon,
      color: d.color,
      phasePrefix: d.phase_prefix,
      kind: d.kind,
    });
  }, []);

  const saveDomain = useCallback(async (): Promise<boolean> => {
    if (!domainEditor) return false;
    if (!editForm.name.trim()) {
      pushToast("领域名称不能为空", "error");
      return false;
    }
    setBusy(true);
    try {
      await apiMutate("/api/domains", "PATCH", {
        key: domainEditor.career_key,
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        icon: editForm.icon,
        color: editForm.color,
        phasePrefix: editForm.phasePrefix.trim(),
        kind: editForm.kind,
      });
      pushToast("领域信息已保存");
      setDomainEditor(null);
      const savedList = await refreshDomains();
      const updated = savedList?.find((x) => x.career_key === career);
      if (updated) setDomain(toDomainIdentity(updated));
      return true;
    } catch (e) {
      pushToast(e instanceof ApiError ? e.message : "保存失败", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [domainEditor, editForm, pushToast, refreshDomains, career, setDomain]);

  const createDomain = useCallback(
    async (templateKey: string | null) => {
      setBusy(true);
      try {
        const res = await apiMutate<{ domain?: DomainRow }>("/api/domains", "POST", templateKey ? { template: templateKey } : {});
        const created = res?.domain;
        setDomainCreator(false);
        pushToast(created ? "已创建「" + created.name + "」" : "已创建新领域");
        const list = await refreshDomains();
        if (created) {
          setDomain(toDomainIdentity(created));
          await switchDomain(created.career_key);
        } else {
          await ensureActive(list);
        }
        return true;
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "创建失败", "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refreshDomains, setDomain, switchDomain, ensureActive]
  );

  const duplicateDomain = useCallback(
    async (d: DomainRow) => {
      setBusy(true);
      try {
        const res = await apiMutate<{ domain?: { name?: string } }>(
          "/api/domains/" + encodeURIComponent(d.career_key) + "/duplicate",
          "POST",
          {}
        );
        pushToast("已复制为「" + (res?.domain?.name ?? "领域副本") + "」");
        await refreshDomains();
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "复制失败", "error");
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refreshDomains]
  );

  const archiveDomain = useCallback(
    async (d: DomainRow) => {
      if (!window.confirm("确定归档「" + d.name + "」？归档后将从领域列表隐藏，学习内容会保留。")) return;
      setBusy(true);
      try {
        await apiMutate("/api/domains", "PATCH", { key: d.career_key, isArchived: true });
        pushToast("已归档「" + d.name + "」");
        const list = await refreshDomains();
        await ensureActive(list);
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "归档失败", "error");
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refreshDomains, ensureActive]
  );

  const deleteDomain = useCallback(
    async (d: DomainRow) => {
      if (!window.confirm("确定删除「" + d.name + "」？其下所有阶段/主题/进度将一并删除，此操作不可恢复。")) return;
      setBusy(true);
      try {
        await apiMutate("/api/domains?key=" + encodeURIComponent(d.career_key), "DELETE");
        pushToast("已删除「" + d.name + "」");
        const list = await refreshDomains();
        await ensureActive(list);
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "删除失败", "error");
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refreshDomains, ensureActive]
  );

  const loadArchived = useCallback(async () => {
    try {
      const data = await apiGet<{ domains?: DomainRow[] }>("/api/domains?archived=1");
      setArchivedDomains(data?.domains ?? []);
    } catch {
      // 已归档列表加载失败时静默（与拆分前一致）
    }
  }, []);

  const openManager = useCallback(() => {
    setDomainManager(true);
    void loadArchived();
  }, [loadArchived]);

  const restoreDomain = useCallback(
    async (d: DomainRow) => {
      setBusy(true);
      try {
        await apiMutate("/api/domains", "PATCH", { key: d.career_key, isArchived: false });
        pushToast("已恢复「" + d.name + "」");
        await Promise.all([refreshDomains(), loadArchived()]);
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "恢复失败", "error");
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refreshDomains, loadArchived]
  );

  const deleteArchivedDomain = useCallback(
    async (d: DomainRow) => {
      if (!window.confirm("确定彻底删除「" + d.name + "」？其下所有阶段/主题/进度将一并删除，此操作不可恢复。")) return;
      setBusy(true);
      try {
        await apiMutate("/api/domains?key=" + encodeURIComponent(d.career_key), "DELETE");
        pushToast("已删除「" + d.name + "」");
        await loadArchived();
      } catch (e) {
        pushToast(e instanceof ApiError ? e.message : "删除失败", "error");
      } finally {
        setBusy(false);
      }
    },
    [pushToast, loadArchived]
  );

  const currentCareer = domains.find((d) => d.career_key === career) ?? null;
  const canEdit = !!currentCareer && !currentCareer.is_locked;

  return {
    domains,
    templates,
    career,
    busy,
    domainManager,
    domainCreator,
    domainEditor,
    editForm,
    archivedDomains,
    archivedOpen,
    currentCareer,
    canEdit,
    setDomainManager,
    setDomainCreator,
    setDomainEditor,
    setEditForm,
    setArchivedOpen,
    switchDomain,
    openManager,
    openDomainEditor,
    saveDomain,
    createDomain,
    duplicateDomain,
    archiveDomain,
    deleteDomain,
    restoreDomain,
    deleteArchivedDomain,
  };
}

export type DomainsState = ReturnType<typeof useDomains>;

// ============================================================================
// useMarkdownImport：MD 导入（选文件/粘贴 → 预览 → 导入）
// ============================================================================

export function useMarkdownImport(career: string, reload: (silent?: boolean) => Promise<void>) {
  const [mdOpen, setMdOpen] = useState(false);
  const [mdText, setMdText] = useState("");
  const [mdInfo, setMdInfo] = useState<{ counts: MdCounts; preview: MdPhasePreview[] } | null>(null);
  const [mdBusy, setMdBusy] = useState(false);
  const [mdError, setMdError] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);

  const readMdFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      setMdText(await file.text());
      setMdInfo(null);
      setMdError(null);
    } catch {
      setMdError("读取文件失败");
    }
  }, []);

  const callImport = useCallback(
    async (dryRun: boolean) => {
      setMdBusy(true);
      setMdError(null);
      try {
        const data = await apiMutate<MdImportResponse>("/api/roadmap/import", "POST", { markdown: mdText, career, dryRun });
        if (dryRun) {
          setMdInfo({
            counts: data?.counts ?? { phases: 0, topics: 0, items: 0 },
            preview: data?.preview ?? [],
          });
        } else {
          const created = data?.created ?? { phases: 0, topics: 0, items: 0 };
          setMdOpen(false);
          setMdInfo(null);
          setMdText("");
          pushToast("已导入 " + created.phases + " 个阶段 · " + created.topics + " 个主题 · " + created.items + " 条学习内容");
          await reload(true);
        }
      } catch (e) {
        setMdError(e instanceof ApiError ? e.message : "导入失败");
      } finally {
        setMdBusy(false);
      }
    },
    [career, mdText, pushToast, reload]
  );

  const openMd = useCallback(() => {
    setMdInfo(null);
    setMdError(null);
    setMdOpen(true);
  }, []);

  return {
    mdOpen,
    setMdOpen,
    mdText,
    setMdText,
    mdInfo,
    setMdInfo,
    mdBusy,
    mdError,
    setMdError,
    readMdFile,
    callImport,
    openMd,
  };
}

export type MarkdownImportState = ReturnType<typeof useMarkdownImport>;

/** 页面用到的 React dispatch 类型再导出，避免 page 重复 import */
export type { Dispatch, SetStateAction };

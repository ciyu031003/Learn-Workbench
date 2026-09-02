"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import type { RoadmapPhase } from "@learn-workbench/shared";
import { pct } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { GlassModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Wrench,
  FolderGit2,
  Target,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  Cpu,
  Layout,
  Coffee,
  ChartLine,
  Brain,
  Shield,
  Compass,
  Languages,
  Activity,
  Volleyball,
  Copy,
  Archive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToastStore } from "@/store/toast-store";

interface RoadmapResponse {
  phases: RoadmapPhase[];
}

type Track = "main" | "agent";

interface DomainRow {
  career_key: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  sort_order: number;
  owner_id: string | null;
  kind: string;
  icon: string;
  color: string;
  phase_prefix: string;
  is_archived: boolean;
  kind_label: string;
}

interface DomainTemplate {
  key: string;
  name: string;
  kindLabel: string;
  icon: string;
  color: string;
  phasePrefix: string;
  description: string;
  weeksNote: string | null;
  phaseCount: number;
}

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  layout: Layout,
  coffee: Coffee,
  "chart-line": ChartLine,
  brain: Brain,
  shield: Shield,
  compass: Compass,
  languages: Languages,
  activity: Activity,
  dribbble: Volleyball,
};

function DomainIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = (icon && DOMAIN_ICONS[icon]) || Compass;
  return <Icon className={className} />;
}

const KIND_OPTIONS = [
  { value: "career", label: "职业成长" },
  { value: "language", label: "语言学习" },
  { value: "sports", label: "运动训练" },
  { value: "hobby", label: "兴趣技能" },
  { value: "life", label: "生活成长" },
  { value: "custom", label: "自定义" },
];

const DOMAIN_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#9333ea",
  "#e11d48",
  "#ea580c",
  "#f59e0b",
  "#2563eb",
  "#6366f1",
];

export default function RoadmapPage() {
  const [phases, setPhases] = useState<RoadmapPhase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [detail, setDetail] = useState<Record<number, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [formPhase, setFormPhase] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [templates, setTemplates] = useState<DomainTemplate[]>([]);
  const [domainManager, setDomainManager] = useState(false);
  const [domainCreator, setDomainCreator] = useState(false);
  const [domainEditor, setDomainEditor] = useState<DomainRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", icon: "", color: "", phasePrefix: "", kind: "" });
  const [busy, setBusy] = useState(false);
  const pushToast = useToastStore((s) => s.push);
  const [career, setCareer] = useState<string>("ict");
  // 大阶段自定义：拖拽排序 + 增删/编辑
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [phaseModal, setPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<RoadmapPhase | null>(null);
  const [phaseForm, setPhaseForm] = useState({ track: "main" as Track, title: "", summary: "", weeks: "" });

  const load = useCallback(async (careerKey: string) => {
    try {
      const r = await fetch(`/api/roadmap?career=${careerKey}`);
      if (!r.ok) throw new Error("load failed");
      const data = (await r.json()) as RoadmapResponse;
      setPhases(data.phases);
      setExpanded((prev) => {
        const next = { ...prev };
        data.phases.forEach((p, i) => {
          if (i < 2 && next[p.id] === undefined) next[p.id] = true;
        });
        return next;
      });
    } catch {
      setError("数据库暂不可用，请确认已运行 scripts\\start_pg.ps1");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [dRes, curRes] = await Promise.all([
          fetch("/api/domains?templates=1"),
          fetch("/api/settings/career"),
        ]);
        const dData = await dRes.json();
        const curData = await curRes.json();
        if (!alive) return;
        const list = (dData.domains ?? []) as DomainRow[];
        setDomains(list);
        setTemplates((dData.templates ?? []) as DomainTemplate[]);
        // 若已保存的领域被归档/删除，回退到第一个可见领域
        const saved = curData.career ?? "ict";
        setCareer(list.some((d) => d.career_key === saved) ? saved : (list[0]?.career_key ?? "ict"));
      } catch {
        // 领域接口不可用时保持默认 ICT
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(career);
  }, [career, load]);

  // 从技能缺口等入口带 #phase-<id> 进入：展开并滚动定位到对应阶段
  useEffect(() => {
    if (!phases) return;
    const m = window.location.hash.match(/^#phase-(\d+)$/);
    if (!m) return;
    const target = Number(m[1]);
    if (!phases.some((p) => p.id === target)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 进入路线图时按 hash 展开目标阶段（既有模式）
    setExpanded((prev) => (prev[target] ? prev : { ...prev, [target]: true }));
    const t = window.setTimeout(() => {
      document.getElementById(`phase-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [phases]);
  const switchDomain = async (key: string) => {
    setCareer(key);
    try {
      await fetch("/api/settings/career", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career: key }),
      });
    } catch {
      // 忽略保存失败
    }
  };

  const refreshDomains = useCallback(async (): Promise<DomainRow[] | null> => {
    try {
      const r = await fetch("/api/domains?templates=1");
      if (!r.ok) return null;
      const d = await r.json();
      const list = (d.domains ?? []) as DomainRow[];
      setDomains(list);
      setTemplates((d.templates ?? []) as DomainTemplate[]);
      return list;
    } catch {
      return null;
    }
  }, []);

  // 当前领域被归档/删除后，自动切到第一个可见领域
  const ensureActive = async (list: DomainRow[] | null) => {
    if (!list) return;
    if (list.some((d) => d.career_key === career)) return;
    const next = list[0]?.career_key;
    if (next && next !== career) {
      pushToast(`已切换到「${list[0]?.name ?? next}」`);
      await switchDomain(next);
    }
  };

  const currentCareer = domains.find((c) => c.career_key === career);
  const canEdit = !!currentCareer && !currentCareer.is_locked;

  const openDomainEditor = (d: DomainRow) => {
    setDomainEditor(d);
    setEditForm({
      name: d.name,
      description: d.description ?? "",
      icon: d.icon,
      color: d.color,
      phasePrefix: d.phase_prefix,
      kind: d.kind,
    });
  };

  const saveDomain = async () => {
    if (!domainEditor) return;
    if (!editForm.name.trim()) {
      pushToast("领域名称不能为空", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: domainEditor.career_key,
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          icon: editForm.icon,
          color: editForm.color,
          phasePrefix: editForm.phasePrefix.trim(),
          kind: editForm.kind,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(d?.error ?? "保存失败", "error");
        return;
      }
      pushToast("领域信息已保存");
      setDomainEditor(null);
      await refreshDomains();
      load(career); // 名称/前缀变更后刷新阶段展示
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const createDomain = async (templateKey: string | null) => {
    setBusy(true);
    try {
      const r = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateKey ? { template: templateKey } : {}),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(d?.error ?? "创建失败", "error");
        return;
      }
      const created = d?.domain as DomainRow | undefined;
      setDomainCreator(false);
      pushToast(created ? `已创建「${created.name}」` : "已创建新领域");
      const list = await refreshDomains();
      if (created) await switchDomain(created.career_key);
      else await ensureActive(list);
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const duplicateDomain = async (d: DomainRow) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/domains/${encodeURIComponent(d.career_key)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(res?.error ?? "复制失败", "error");
        return;
      }
      pushToast(`已复制为「${res?.domain?.name ?? "领域副本"}」`);
      await refreshDomains();
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const archiveDomain = async (d: DomainRow) => {
    if (!window.confirm(`确定归档「${d.name}」？归档后将从领域列表隐藏，学习内容会保留。`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: d.career_key, isArchived: true }),
      });
      const res = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(res?.error ?? "归档失败", "error");
        return;
      }
      pushToast(`已归档「${d.name}」`);
      const list = await refreshDomains();
      await ensureActive(list);
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteDomain = async (d: DomainRow) => {
    if (!window.confirm(`确定删除「${d.name}」？其下所有阶段/主题/进度将一并删除，此操作不可恢复。`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/domains?key=${encodeURIComponent(d.career_key)}`, { method: "DELETE" });
      const res = await r.json().catch(() => null);
      if (!r.ok) {
        pushToast(res?.error ?? "删除失败", "error");
        return;
      }
      pushToast(`已删除「${d.name}」`);
      const list = await refreshDomains();
      await ensureActive(list);
    } catch {
      pushToast("网络异常，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (topicId: number, done: boolean) => {
    setPhases((prev) =>
      prev?.map((p) => ({
        ...p,
        topics: p.topics.map((t) => (t.id === topicId ? { ...t, done, note: t.note } : t)),
      })) ?? prev
    );
    await fetch("/api/progress", {
      method: "POST",
      body: JSON.stringify({ topicId, done }),
    });
  };

  const togglePhase = (id: number) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const addCustom = async () => {
    const phaseId = Number(formPhase);
    if (!Number.isFinite(phaseId) || !formTitle.trim()) return;
    const r = await fetch("/api/roadmap/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, title: formTitle.trim(), summary: formSummary.trim() || null }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setError(data?.error ?? "添加失败");
      return;
    }
    setFormPhase("");
    setFormTitle("");
    setFormSummary("");
    setAdding(false);
    load(career);
  };

  const deleteCustom = async (topicId: number) => {
    await fetch(`/api/roadmap/custom?topicId=${topicId}`, { method: "DELETE" });
    load(career);
  };
  const toggleDetail = (id: number) => setDetail((s) => ({ ...s, [id]: !s[id] }));

  // ---------- 大阶段：拖拽排序 ----------
  const onPhaseDragStart = (e: ReactDragEvent, phase: RoadmapPhase) => {
    if (!canEdit) return;
    setDragId(phase.id);
    e.dataTransfer.setData("text/plain", String(phase.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onPhaseDragOver = (e: ReactDragEvent, phase: RoadmapPhase) => {
    if (dragId == null || dragId === phase.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== phase.id) setDragOverId(phase.id);
  };

  const saveOrder = async (track: Track, order: number[]) => {
    try {
      const r = await fetch("/api/roadmap/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career, track, order }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setError(d?.error ?? "排序保存失败");
      }
    } catch {
      setError("排序保存失败");
    }
    load(career); // 重新拉取，同步自动更名后的 P 编号
  };

  const onPhaseDrop = (e: ReactDragEvent, track: Track) => {
    e.preventDefault();
    const fromId = dragId;
    const toId = dragOverId;
    setDragId(null);
    setDragOverId(null);
    if (fromId == null || toId == null || fromId === toId) return;
    const list = phases?.filter((p) => p.track === track) ?? [];
    const fromIdx = list.findIndex((p) => p.id === fromId);
    const toIdx = list.findIndex((p) => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const order = next.map((p) => p.id);
    // 乐观更新：先本地换位，后台保存成功后重新拉取
    setPhases((prev) => {
      if (!prev) return prev;
      const nextMap = new Map(next.map((p, i) => [p.id, { ...p, sortOrder: i }]));
      return prev.map((p) => (p.track === track && nextMap.has(p.id) ? (nextMap.get(p.id) as RoadmapPhase) : p));
    });
    void saveOrder(track, order);
  };

  const onPhaseDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  // ---------- 大阶段：新增 / 编辑 / 删除 ----------
  const openAddPhase = () => {
    setEditingPhase(null);
    setPhaseForm({ track: "main", title: "", summary: "", weeks: "" });
    setPhaseModal(true);
  };

  const openEditPhase = (phase: RoadmapPhase) => {
    setEditingPhase(phase);
    setPhaseForm({
      track: phase.track,
      title: phase.title,
      summary: phase.summary ?? "",
      weeks: phase.weeks ?? "",
    });
    setPhaseModal(true);
  };

  const savePhase = async () => {
    if (!phaseForm.title.trim()) return;
    const payload = {
      career,
      track: phaseForm.track,
      title: phaseForm.title.trim(),
      summary: phaseForm.summary.trim() || null,
      weeks: phaseForm.weeks.trim() || null,
    };
    const r = editingPhase
      ? await fetch("/api/roadmap/phases", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingPhase.id }),
        })
      : await fetch("/api/roadmap/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(d?.error ?? "保存失败");
      return;
    }
    setPhaseModal(false);
    load(career);
  };

  const deletePhase = async (phase: RoadmapPhase) => {
    if (!window.confirm(`确定删除大阶段「${phase.title}」？其下所有主题/内容将一并删除，此操作不可恢复。`)) return;
    const r = await fetch(`/api/roadmap/phases?id=${phase.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(d?.error ?? "删除失败");
      return;
    }
    load(career);
  };

  const main = useMemo(() => phases?.filter((p) => p.track === "main") ?? [], [phases]);
  const agent = useMemo(() => phases?.filter((p) => p.track === "agent") ?? [], [phases]);

  const overall = useMemo(() => {
    if (!phases) return 0;
    const all = phases.flatMap((p) => p.topics);
    return pct(all.filter((t) => t.done).length, all.length);
  }, [phases]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-danger">{error}</CardContent>
      </Card>
    );
  }
  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">学习路线图</h1>
          <p className="page-subtitle mt-1 text-sm">
            {currentCareer ? `${currentCareer.name} · 主题完成即打勾，进度自动聚合` : "学习领域 · 主题完成即打勾，进度自动聚合"}
            {canEdit
              ? "（可编辑：拖动排序、增删/编辑阶段、添加主题）"
              : "（只读）"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDomainManager(true)}
            aria-label="切换学习领域"
            title="切换 / 管理学习领域"
            className="flex h-10 max-w-60 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 text-sm backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-white/18 sm:max-w-72"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${currentCareer?.color ?? "#6366f1"}26`, color: currentCareer?.color ?? "#6366f1" }}
            >
              <DomainIcon icon={currentCareer?.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left font-medium">{currentCareer?.name ?? "学习领域"}</span>
            {currentCareer ? <Badge variant="muted" className="hidden shrink-0 sm:inline-flex">{currentCareer.kind_label}</Badge> : null}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => setDomainCreator(true)}>
            <Plus className="size-4" /> 新建
          </Button>
        </div>
      </div>

      {!phases ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : (
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
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
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
                className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
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
                          <DomainIcon icon={d.icon} className="size-4.5" />
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
                  <Plus className="size-4.5" />
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
                    <DomainIcon icon={t.icon} className="size-4.5" />
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
                    className="glass-select h-10 rounded-xl px-3 text-sm outline-none backdrop-blur-md focus:border-primary/60"
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
                className={`roadmap-phase-card ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-primary/60" : ""}`}
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
                className={`roadmap-phase-card border-accent/20 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === phase.id ? "opacity-50" : ""} ${dragOverId === phase.id && dragId !== phase.id ? "ring-2 ring-accent/60" : ""}`}
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
      )}
    </div>
  );
}
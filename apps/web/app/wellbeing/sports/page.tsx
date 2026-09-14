"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SPORT_CATALOG, handLabels, type Hand, type SportsGearItem, type SportsProfile,
} from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToastStore } from "@/store/toast-store";
import { Plus, Trash2, Pencil, Share2, Trophy, ChevronLeft, Loader2, Dumbbell } from "lucide-react";

interface DraftPair {
  label: string;
  value: string;
}

interface FormState {
  id: number | null;
  sportKey: string;
  identity: string;
  levelText: string;
  handedness: "" | Hand;
  playStyle: string;
  photoUrl: string;
  gear: DraftPair[];
  highlights: DraftPair[];
  isPublic: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  sportKey: "badminton",
  identity: "",
  levelText: "",
  handedness: "",
  playStyle: "",
  photoUrl: "",
  gear: [{ label: "球拍", value: "" }, { label: "球鞋", value: "" }, { label: "球线", value: "" }, { label: "手胶", value: "" }],
  highlights: [],
  isPublic: false,
};

const DEFAULT_GEAR_LABELS = ["球拍", "球鞋", "球线", "手胶"];

export default function SportsProfilePage() {
  const pushToast = useToastStore((s) => s.push);
  const [profiles, setProfiles] = useState<SportsProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const sportName = useMemo(() => {
    const m = new Map(SPORT_CATALOG.map((s) => [s.key, s.name]));
    return (key: string) => m.get(key) ?? key;
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sports/profiles");
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setProfiles(Array.isArray(d.profiles) ? d.profiles : []);
    } catch {
      pushToast("运动档案加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, gear: DEFAULT_GEAR_LABELS.map((label) => ({ label, value: "" })) });
    setOpen(true);
  };

  const openEdit = (p: SportsProfile) => {
    setForm({
      id: p.id,
      sportKey: p.sportKey,
      identity: p.identity ?? "",
      levelText: p.levelText ?? "",
      handedness: (p.handedness ?? "") as "" | Hand,
      playStyle: p.playStyle ?? "",
      photoUrl: p.photoUrl ?? "",
      gear: (p.gear ?? []).length > 0 ? p.gear.map((g) => ({ label: g.label, value: g.value })) : DEFAULT_GEAR_LABELS.map((label) => ({ label, value: "" })),
      highlights: (p.highlights ?? []).map((g) => ({ label: g.label, value: g.value })),
      isPublic: p.isPublic,
    });
    setOpen(true);
  };

  const save = async () => {
    const gear = form.gear.filter((g) => g.label.trim() && g.value.trim());
    const highlights = form.highlights.filter((g) => g.label.trim() && g.value.trim());
    setSaving(true);
    try {
      const payload = {
        sportKey: form.sportKey,
        identity: form.identity,
        levelText: form.levelText,
        handedness: form.handedness || null,
        playStyle: form.playStyle,
        photoUrl: form.photoUrl,
        gear,
        highlights,
        isPublic: form.isPublic,
      };
      const r = form.id
        ? await fetch(`/api/sports/profiles/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/sports/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast(form.id ? "已更新" : "已创建档案");
      setOpen(false);
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async (p: SportsProfile, next: boolean) => {
    try {
      const r = await fetch(`/api/sports/profiles/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!r.ok) throw new Error("操作失败");
      pushToast(next ? "已开启公开分享" : "已关闭公开分享");
      await load();
    } catch {
      pushToast("操作失败", "error");
    }
  };

  const remove = async (p: SportsProfile) => {
    if (!window.confirm(`删除「${sportName(p.sportKey)}」档案？`)) return;
    try {
      const r = await fetch(`/api/sports/profiles/${p.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      pushToast("已删除");
      await load();
    } catch {
      pushToast("删除失败", "error");
    }
  };

  const setPair = (kind: "gear" | "highlights", i: number, patch: Partial<DraftPair>) => {
    setForm((s) => ({ ...s, [kind]: s[kind].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/wellbeing"><ChevronLeft className="size-4" /> 健康</Link>
          </Button>
          <h1 className="page-title mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight lg:text-3xl">
            <Dumbbell className="size-6 text-primary" /> 运动档案
          </h1>
          <p className="page-subtitle mt-1 text-sm">
            运动身份卡 · 默认不公开；公开时只展示运动身份 / 等级 / 装备 / 公开成绩 / 照片
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> 新建档案</Button>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </CardContent></Card>
      ) : profiles.length === 0 ? (
        <EmptyState icon={Trophy} title="还没有运动档案" hint="建立一张「羽球档案」风格的卡片，可选择性公开分享" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-base font-extrabold">
                      🏸 {sportName(p.sportKey)}档案
                    </p>
                    {p.identity ? <p className="mt-1 text-sm font-semibold">{p.identity}</p> : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.playStyle, p.handedness ? handLabels[p.handedness] : null, p.levelText].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      公开
                      <Switch checked={p.isPublic} onCheckedChange={(v) => void togglePublic(p, v)} />
                    </label>
                    {p.isPublic && p.shareSlug ? (
                      <Link href={`/share/sport/${p.shareSlug}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                        <Share2 className="size-3" /> 分享链接
                      </Link>
                    ) : null}
                  </div>
                </div>

                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
                ) : null}

                {(p.gear ?? []).length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">主力装备</p>
                    <div className="flex flex-col gap-1">
                      {(p.gear ?? []).map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{g.label}</span>
                          <span className="font-medium">{g.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(p.highlights ?? []).length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">公开成绩</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(p.highlights ?? []).map((h, i) => (
                        <Badge key={i} variant="accent">{h.label} · {h.value}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-1 pt-1">
                  <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="编辑">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => void remove(p)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="删除">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GlassModal open={open} onClose={() => setOpen(false)} title={form.id ? "编辑运动档案" : "新建运动档案"} className="max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">运动项目</label>
              <select
                value={form.sportKey}
                onChange={(e) => setForm((s) => ({ ...s, sportKey: e.target.value }))}
                className="h-9 w-full rounded-xl border border-border bg-card/60 px-3 text-sm"
                disabled={form.id !== null}
              >
                {SPORT_CATALOG.map((s) => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">等级</label>
              <Input value={form.levelText} onChange={(e) => setForm((s) => ({ ...s, levelText: e.target.value }))} placeholder="如：中羽 1 级" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">运动身份</label>
              <Input value={form.identity} onChange={(e) => setForm((s) => ({ ...s, identity: e.target.value }))} placeholder="如：双打搭子" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">打法</label>
              <Input value={form.playStyle} onChange={(e) => setForm((s) => ({ ...s, playStyle: e.target.value }))} placeholder="如：混双" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">惯用手</label>
            <div className="flex gap-1.5">
              {([["", "不填"], ["right", "右手"], ["left", "左手"]] as const).map(([key, label]) => (
                <button
                  key={key || "none"}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, handedness: key as "" | Hand }))}
                  className={`flex-1 rounded-xl border px-3 py-1.5 text-sm ${form.handedness === key ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">照片链接</label>
            <Input value={form.photoUrl} onChange={(e) => setForm((s) => ({ ...s, photoUrl: e.target.value }))} placeholder="https://…" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">主力装备</label>
            <div className="flex flex-col gap-2">
              {form.gear.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="w-24" value={g.label} onChange={(e) => setPair("gear", i, { label: e.target.value })} placeholder="类别" />
                  <Input className="flex-1" value={g.value} onChange={(e) => setPair("gear", i, { value: e.target.value })} placeholder="型号" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium">公开成绩</label>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setForm((s) => ({ ...s, highlights: [...s.highlights, { label: "", value: "" }] }))}>
                <Plus className="size-3.5" /> 添加
              </Button>
            </div>
            {form.highlights.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">可选，用于公开分享</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="w-32" value={h.label} onChange={(e) => setPair("highlights", i, { label: e.target.value })} placeholder="赛事" />
                    <Input className="flex-1" value={h.value} onChange={(e) => setPair("highlights", i, { value: e.target.value })} placeholder="成绩" />
                    <button
                      onClick={() => setForm((s) => ({ ...s, highlights: s.highlights.filter((_, j) => j !== i) }))}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                      aria-label="移除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
            <span className="text-sm">公开分享</span>
            <Switch checked={form.isPublic} onCheckedChange={(v) => setForm((s) => ({ ...s, isPublic: v }))} />
          </label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            公开后仅展示：运动身份、等级、惯用手、打法、装备、公开成绩、照片、昵称。
            不会公开体重、年龄、身体测量、饮食或训练细节。
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SPORT_CATALOG, computeSportsRecord, equipmentCategoryForGearLabel, gearRowWantsImage, handLabels, mergeGearWithTemplate, sportGearTemplate, type Hand, type SportsProfile,
} from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { HoloSportCardLazy } from "@/components/holo/holo-sport-card-lazy";
import { cardModelFor } from "@/lib/sports-card-view";
import { hasHoloArt } from "@/lib/holo-card-text";
import { deleteUpload, kindFromGearLabel, uploadImageFile, type UploadKind } from "@/lib/media";
import { EquipmentPickerModal } from "@/components/equipment/equipment-picker-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToastStore } from "@/store/toast-store";
import { Camera, Plus, Trash2, Pencil, Share2, Sparkles, Trophy, ChevronLeft, Loader2, Dumbbell } from "lucide-react";

interface DraftPair {
  label: string;
  value: string;
  /** 装备图片（用户上传或图库商品图） */
  imageUrl?: string | null;
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
  /** 战绩（卡面右侧栏）—— 输入框里是字符串，保存时归一化 */
  matchesPlayed: string;
  wins: string;
  losses: string;
  /** 绝技（卡面主视觉大字） */
  signatureMove: string;
  /** 档案图鉴四宫格（迁移 050） */
  shoeSize: string;
  tensionLbs: string;
  isPublic: boolean;
}

/** 按运动项目给出装备录入行（拍类区分球拍型号 / 球拍类型 / 球鞋类型） */
function gearRows(sportKey: string): DraftPair[] {
  return sportGearTemplate(sportKey).map((label) => ({ label, value: "" }));
}

const EMPTY_FORM: FormState = {
  id: null,
  sportKey: "badminton",
  identity: "",
  levelText: "",
  handedness: "",
  playStyle: "",
  photoUrl: "",
  gear: gearRows("badminton"),
  highlights: [],
  matchesPlayed: "",
  wins: "",
  losses: "",
  signatureMove: "",
  shoeSize: "",
  tensionLbs: "",
  isPublic: false,
};

export default function SportsProfilePage() {
  const pushToast = useToastStore((s) => s.push);
  const [profiles, setProfiles] = useState<SportsProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  /** 正在上传哪张图（用于禁用按钮） */
  const [uploading, setUploading] = useState<string | null>(null);
  /** 正在从图库选装备的装备行下标 */
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  /** 正在看闪光卡的档案 */
  const [cardProfile, setCardProfile] = useState<SportsProfile | null>(null);

  const sportName = useMemo(() => {
    const m = new Map(SPORT_CATALOG.map((s) => [s.key, s.name]));
    return (key: string) => m.get(key) ?? key;
  }, []);

  const cardModel = useMemo(() => {
    if (!cardProfile) return null;
    const index = Math.max(1, profiles.findIndex((x) => x.id === cardProfile.id) + 1);
    return cardModelFor(cardProfile, index, Math.max(1, profiles.length));
  }, [cardProfile, profiles]);

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
    setForm({ ...EMPTY_FORM, gear: gearRows(EMPTY_FORM.sportKey) });
    setOpen(true);
  };

  const openEdit = (p: SportsProfile) => {
    // 老档案「球拍型号 / 球拍类型」合并为一行「球拍」，「磅数」行落到图鉴四宫格
    const merged = mergeGearWithTemplate(p.sportKey, p.gear ?? []);
    setForm({
      id: p.id,
      sportKey: p.sportKey,
      identity: p.identity ?? "",
      levelText: p.levelText ?? "",
      handedness: (p.handedness ?? "") as "" | Hand,
      playStyle: p.playStyle ?? "",
      photoUrl: p.photoUrl ?? "",
      gear: merged.gear.map((g) => ({ label: g.label, value: g.value, imageUrl: g.imageUrl ?? null })),
      highlights: (p.highlights ?? []).map((g) => ({ label: g.label, value: g.value })),
      matchesPlayed: p.matchesPlayed > 0 ? String(p.matchesPlayed) : "",
      wins: p.wins > 0 ? String(p.wins) : "",
      losses: p.losses > 0 ? String(p.losses) : "",
      signatureMove: p.signatureMove ?? "",
      shoeSize: p.shoeSize ?? "",
      tensionLbs:
        p.tensionLbs === null || p.tensionLbs === undefined
          ? merged.tensionLbs === null
            ? ""
            : String(merged.tensionLbs)
          : String(p.tensionLbs),
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
        matchesPlayed: Number(form.matchesPlayed) || 0,
        wins: Number(form.wins) || 0,
        losses: Number(form.losses) || 0,
        signatureMove: form.signatureMove,
        shoeSize: form.shoeSize,
        tensionLbs: form.tensionLbs === "" ? null : Number(form.tensionLbs),
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

  /** 上传一张图到站内并回填（avatar → 照片链接；gear → 对应装备行） */
  const handleUpload = async (key: string, kind: UploadKind, file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    setUploading(key);
    try {
      const { url } = await uploadImageFile(kind, file);
      apply(url);
      pushToast("图片已上传");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "上传失败", "error");
    } finally {
      setUploading(null);
    }
  };

  /** 换图时把上一张自己传的图删掉 */
  const replaceUpload = async (previous: string | null | undefined, next: string) => {
    if (previous && previous.startsWith("/uploads/") && previous !== next) await deleteUpload(previous);
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
                    {p.shoeSize || p.tensionLbs ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[p.shoeSize ? "鞋码 " + p.shoeSize : null, p.tensionLbs ? "磅数 " + p.tensionLbs : null].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
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
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            {g.imageUrl && gearRowWantsImage(g.label) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.imageUrl} alt="" className="size-8 shrink-0 rounded-lg border border-border/50 bg-white object-contain" />
                            ) : null}
                            {g.label}
                          </span>
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

                {(() => {
                  const record = computeSportsRecord(p);
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg bg-muted/60 px-2 py-1 text-[11px] font-semibold">{record.matches} 场</span>
                      <span className="rounded-lg bg-muted/60 px-2 py-1 text-[11px]">{record.wins} 胜 / {record.losses} 负</span>
                      <span className="rounded-lg bg-muted/60 px-2 py-1 text-[11px]">胜率 {record.winRate === null ? "—" : record.winRate.toFixed(1) + "%"}</span>
                      {p.signatureMove ? (
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{p.signatureMove}</span>
                      ) : null}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-1 pt-1">
                  {hasHoloArt(p.sportKey) ? (
                    <button onClick={() => setCardProfile(p)} className="mr-auto inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
                      <Sparkles className="size-3.5" /> 查看闪光卡
                    </button>
                  ) : null}
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
                onChange={(e) => setForm((s) => ({ ...s, sportKey: e.target.value, gear: gearRows(e.target.value) }))}
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
            <label className="mb-1 block text-xs font-medium">本人照片</label>
            <div className="flex items-center gap-2">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-dashed border-border/60 text-muted-foreground">
                  <Camera className="size-4" />
                </div>
              )}
              <Input value={form.photoUrl} onChange={(e) => setForm((s) => ({ ...s, photoUrl: e.target.value }))} placeholder="上传或粘贴图片地址" />
              <label className="shrink-0 cursor-pointer rounded-xl border border-border/60 px-3 py-2 text-xs hover:bg-muted/60">
                {uploading === "avatar" ? "上传中…" : "上传"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void handleUpload("avatar", "avatar", file, (url) => {
                      void replaceUpload(form.photoUrl, url);
                      setForm((s) => ({ ...s, photoUrl: url }));
                    });
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">主力装备</label>
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              只有球拍 / 球鞋 / 比赛用球配图；拍线、手胶这类只填文字，磅数填在图鉴四宫格。
            </p>
            <div className="flex flex-col gap-2">
              {form.gear.map((g, i) => {
                // 只有球拍 / 球鞋 / 比赛用球配图，其余行（拍线、手胶、磅数…）纯文字
                const wantsImage = gearRowWantsImage(g.label);
                return (
                  <div key={i} className="flex items-center gap-2">
                    {wantsImage ? (
                      <label className="grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/50">
                        {g.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.imageUrl} alt="" className="size-full object-contain" />
                        ) : (
                          <Camera className="size-4" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            void handleUpload("gear-" + i, kindFromGearLabel(g.label), file, (url) => {
                              void replaceUpload(g.imageUrl, url);
                              setPair("gear", i, { imageUrl: url });
                            });
                          }}
                        />
                      </label>
                    ) : (
                      <span className="size-11 shrink-0" />
                    )}
                    <Input className="w-24" value={g.label} onChange={(e) => setPair("gear", i, { label: e.target.value })} placeholder="类别" />
                    <Input className="flex-1" value={g.value} onChange={(e) => setPair("gear", i, { value: e.target.value })} placeholder={wantsImage ? "型号 / 类型" : "文字即可"} />
                    {wantsImage ? (
                      <button
                        type="button"
                        onClick={() => setPickerIndex(pickerIndex === i ? null : i)}
                        className="shrink-0 rounded-xl border border-border/60 px-2.5 py-2 text-[11px] hover:bg-muted/60"
                        aria-label="从图库选择"
                      >
                        图库
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">战绩（上卡面右侧栏）</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["matchesPlayed", "比赛场次", "214"],
                ["wins", "胜场", "178"],
                ["losses", "负场", "36"],
              ] as const).map(([key, label, placeholder]) => (
                <label key={key} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {label}
                  <Input
                    inputMode="numeric"
                    value={form[key]}
                    onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">只填胜负也行：场次自动按「胜 + 负」补齐，胜率自动计算。</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">绝技（卡面大字）</label>
            <Input
              value={form.signatureMove}
              onChange={(e) => setForm((s) => ({ ...s, signatureMove: e.target.value }))}
              placeholder="如：疾风·劈杀"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">鞋码（档案图鉴）</label>
              <Input
                value={form.shoeSize}
                onChange={(e) => setForm((s) => ({ ...s, shoeSize: e.target.value }))}
                placeholder="如：40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">磅数（档案图鉴）</label>
              <Input
                inputMode="decimal"
                value={form.tensionLbs}
                onChange={(e) => setForm((s) => ({ ...s, tensionLbs: e.target.value.replace(/[^0-9.]/g, "") }))}
                placeholder="如：27.5"
              />
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

      {pickerIndex !== null ? (
        <EquipmentPickerModal
          open
          onClose={() => setPickerIndex(null)}
          onPick={(item) => {
            setPair("gear", pickerIndex, { value: item.model, imageUrl: item.imageUrl });
          }}
          sportKey={form.sportKey}
          defaultCategory={equipmentCategoryForGearLabel(form.sportKey, form.gear[pickerIndex]?.label ?? "")}
        />
      ) : null}

      {cardModel ? (
        <GlassModal
          open
          onClose={() => setCardProfile(null)}
          title={`${cardModel.title} · 闪光卡`}
          className="max-w-md"
        >
          <HoloSportCardLazy model={cardModel} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            卡面由档案数据实时合成：等级与装备在左栏，战绩在右栏，绝技在底部大字；
            拖动转卡、滚轮缩放，能看到镭射与景深随视角变化（导出为 PNG 也可以）。
          </p>
        </GlassModal>
      ) : null}
    </div>
  );
}
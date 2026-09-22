"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { certificateStatusLabels, certificateExpiryInfo, type Certificate } from "@learn-workbench/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, FloatField } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToastStore } from "@/store/toast-store";
import { Plus, Pencil, Trash2, Award, CalendarClock, ExternalLink, Trophy } from "lucide-react";

type Status = "planned" | "preparing" | "achieved";

interface FormState {
  id: number | null;
  name: string;
  issuer: string;
  status: Status;
  targetDate: string;
  earnedDate: string;
  expiryDate: string;
  imageUrl: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  issuer: "",
  status: "planned",
  targetDate: "",
  earnedDate: "",
  expiryDate: "",
  imageUrl: "",
  note: "",
};

const STATUS_VARIANT: Record<Status, "muted" | "warning" | "success"> = {
  planned: "muted",
  preparing: "warning",
  achieved: "success",
};

export default function CareerCertificatesPage() {
  const pushToast = useToastStore((s) => s.push);
  const [records, setRecords] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/certificates");
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setRecords(Array.isArray(d.records) ? d.records : []);
    } catch {
      pushToast("证书加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (c: Certificate) => {
    setForm({
      id: c.id,
      name: c.name ?? "",
      issuer: c.issuer ?? "",
      status: (c.status ?? "planned") as Status,
      targetDate: c.targetDate ?? "",
      earnedDate: c.earnedDate ?? "",
      expiryDate: c.expiryDate ?? "",
      imageUrl: c.imageUrl ?? "",
      note: c.note ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      pushToast("请填写证书名称", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        issuer: form.issuer,
        status: form.status,
        targetDate: form.targetDate || null,
        earnedDate: form.earnedDate || null,
        expiryDate: form.expiryDate || null,
        imageUrl: form.imageUrl,
        note: form.note,
      };
      const r = form.id
        ? await fetch("/api/certificates", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: form.id, ...payload }),
          })
        : await fetch("/api/certificates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast(form.id ? "已更新" : "已添加");
      setOpen(false);
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Certificate) => {
    if (!window.confirm(`确定删除证书「${c.name}」？`)) return;
    try {
      const r = await fetch(`/api/certificates?id=${c.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      pushToast("已删除");
      await load();
    } catch {
      pushToast("删除失败", "error");
    }
  };

  // 即将过期 / 已过期优先展示
  const { expiring, valid } = useMemo(() => {
    const e: Certificate[] = [];
    const v: Certificate[] = [];
    for (const c of records) {
      const info = certificateExpiryInfo(c.expiryDate);
      if (info.level === "soon" || info.level === "expired") e.push(c);
      else v.push(c);
    }
    return { expiring: e, valid: v };
  }, [records]);

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">我的证书</h1>
          <p className="page-subtitle mt-1 text-sm">证书 / 资格 / 认证 —— 独立领域，简历与职业雷达共用</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> 添加证书
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">加载中…</CardContent></Card>
      ) : records.length === 0 ? (
        <EmptyState
          icon={Award}
          title="还没有证书"
          hint="添加你的第一张证书，例如 CISP、HCIP-Datacom、天翼云 ACP"
          action={<Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> 添加证书</Button>}
        />
      ) : (
        <>
          {expiring.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-warning" /> 需要关注（即将/已过期）
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {expiring.map((c) => (
                  <CertCard key={c.id} c={c} onEdit={openEdit} onDelete={remove} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            {expiring.length > 0 ? <h2 className="text-sm font-semibold">全部证书</h2> : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {valid.map((c) => (
                <CertCard key={c.id} c={c} onEdit={openEdit} onDelete={remove} />
              ))}
            </div>
          </section>
        </>
      )}

      <GlassModal open={open} onClose={() => setOpen(false)} title={form.id ? "编辑证书" : "添加证书"}>
        <div className="flex flex-col gap-4">
          {/* v13 U6：浮动标签输入（技法参考 uiverse.io/Li-Deheng/tiny-chicken-50, MIT） */}
          <FloatField label="证书名称 *" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
          <FloatField label="颁发机构" value={form.issuer} onChange={(v) => setForm((s) => ({ ...s, issuer: v }))} />
          <div>
            <label className="mb-1 block text-xs font-medium">状态</label>
            <div className="flex gap-2">
              {(["planned", "preparing", "achieved"] as Status[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, status: st }))}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-all ${
                    form.status === st
                      ? "bg-primary/25 text-foreground ring-1 ring-primary/50"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {certificateStatusLabels[st]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">计划考取</label>
              <Input type="date" value={form.targetDate} onChange={(e) => setForm((s) => ({ ...s, targetDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">取得日期</label>
              <Input type="date" value={form.earnedDate} onChange={(e) => setForm((s) => ({ ...s, earnedDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">有效期至</label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm((s) => ({ ...s, expiryDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">证书图片链接（可选）</label>
            <Input value={form.imageUrl} onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">备注</label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder="证书编号、备考笔记等" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}

function CertCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Certificate;
  onEdit: (c: Certificate) => void;
  onDelete: (c: Certificate) => void;
}) {
  const status = (c.status ?? "planned") as Status;
  const info = certificateExpiryInfo(c.expiryDate);
  const achieved = status === "achieved";
  return (
    <Card className="lift relative overflow-hidden">
      {/* v13 U11：已达成证书做“奖杯卡”（技法参考 uiverse.io/sohoning/ugly-horse-87, MIT） */}
      {achieved ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-warning to-primary" />
      ) : null}
      {achieved ? (
        <span
          aria-hidden
          className="pattern-bauhaus pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]"
        />
      ) : null}
      <CardContent className="relative flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                achieved ? "bg-accent/15 text-accent-strong ring-1 ring-accent/30" : "bg-primary/15 text-primary"
              }`}
            >
              {achieved ? <Trophy className="size-5" /> : <Award className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              {c.issuer ? <p className="truncate text-xs text-muted-foreground">{c.issuer}</p> : null}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[status]}>{certificateStatusLabels[status]}</Badge>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {c.earnedDate ? <span>取得：{c.earnedDate.slice(0, 10)}</span> : null}
          {info.level !== "none" ? (
            <span className={info.level === "expired" ? "text-danger" : info.level === "soon" ? "text-warning" : ""}>
              {info.label}
            </span>
          ) : c.targetDate ? (
            <span>计划考取：{c.targetDate.slice(0, 10)}</span>
          ) : null}
        </div>

        {c.note ? <p className="line-clamp-2 text-xs text-muted-foreground">{c.note}</p> : null}

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            {c.imageUrl ? (
              <a href={c.imageUrl} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground" aria-label="查看证书图片">
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground" aria-label="编辑">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-danger" aria-label="删除">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
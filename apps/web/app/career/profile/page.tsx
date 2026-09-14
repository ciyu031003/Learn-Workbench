"use client";

import { useCallback, useEffect, useState } from "react";
import type { EducationItem, ExperienceItem } from "@learn-workbench/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToastStore } from "@/store/toast-store";
import { Plus, Trash2, Save, User, MapPin, Target } from "lucide-react";

interface ProfileState {
  education: EducationItem[];
  experiences: ExperienceItem[];
  currentCity: string;
  targetRole: string;
  bio: string;
}

const EMPTY_EDU: EducationItem = { school: "", major: "", degree: "", start: "", end: "", note: "" };
const EMPTY_EXP: ExperienceItem = { title: "", org: "", start: "", end: "", description: "", skills: [] };

export default function CareerProfilePage() {
  const pushToast = useToastStore((s) => s.push);
  const [data, setData] = useState<ProfileState>({
    education: [],
    experiences: [],
    currentCity: "",
    targetRole: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/profile/info");
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setData({
        education: Array.isArray(d.education) ? d.education : [],
        experiences: Array.isArray(d.experiences) ? d.experiences : [],
        currentCity: d.currentCity ?? "",
        targetRole: d.targetRole ?? "",
        bio: d.bio ?? "",
      });
    } catch {
      pushToast("个人资料加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/profile/info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          education: data.education,
          experiences: data.experiences,
          currentCity: data.currentCity,
          targetRole: data.targetRole,
          bio: data.bio,
        }),
      });
      if (!r.ok) throw new Error("保存失败");
      pushToast("已保存");
    } catch {
      pushToast("保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = (p: Partial<ProfileState>) => setData((s) => ({ ...s, ...p }));

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">我的资料</h1>
          <p className="page-subtitle mt-1 text-sm">基本资料 / 教育 / 经历 —— 供简历、职业就绪度、就业雷达复用</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="size-4" />
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">加载中…</CardContent></Card>
      ) : (
        <>
          {/* 基本资料 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-primary" /> 基本资料
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">期望城市</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={data.currentCity}
                      onChange={(e) => patch({ currentCity: e.target.value })} placeholder="如：乌鲁木齐 / 北京" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">目标岗位</label>
                  <div className="relative">
                    <Target className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={data.targetRole}
                      onChange={(e) => patch({ targetRole: e.target.value })} placeholder="如：网络安全工程师" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">一句话简介</label>
                <Textarea value={data.bio} onChange={(e) => patch({ bio: e.target.value })}
                  placeholder="用一句话介绍自己" rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* 教育经历 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">教育经历</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1"
                onClick={() => patch({ education: [...data.education, { ...EMPTY_EDU }] })}>
                <Plus className="size-4" /> 添加
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.education.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂未添加教育经历</p>
              ) : (
                data.education.map((e, i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="muted">{i + 1}</Badge>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={() => patch({ education: data.education.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="学校" value={e.school}
                        onChange={(ev) => patch({ education: setAt(data.education, i, { ...e, school: ev.target.value }) })} />
                      <Input placeholder="专业" value={e.major}
                        onChange={(ev) => patch({ education: setAt(data.education, i, { ...e, major: ev.target.value }) })} />
                      <Input placeholder="学位" value={e.degree}
                        onChange={(ev) => patch({ education: setAt(data.education, i, { ...e, degree: ev.target.value }) })} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="起" value={e.start ?? ""}
                          onChange={(ev) => patch({ education: setAt(data.education, i, { ...e, start: ev.target.value }) })} />
                        <Input placeholder="止" value={e.end ?? ""}
                          onChange={(ev) => patch({ education: setAt(data.education, i, { ...e, end: ev.target.value }) })} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* 工作/项目经历 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">工作 / 项目经历</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1"
                onClick={() => patch({ experiences: [...data.experiences, { ...EMPTY_EXP }] })}>
                <Plus className="size-4" /> 添加
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.experiences.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂未添加经历</p>
              ) : (
                data.experiences.map((x, i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="muted">{i + 1}</Badge>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={() => patch({ experiences: data.experiences.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="职位/角色" value={x.title}
                        onChange={(ev) => patch({ experiences: setAt(data.experiences, i, { ...x, title: ev.target.value }) })} />
                      <Input placeholder="公司/组织" value={x.org}
                        onChange={(ev) => patch({ experiences: setAt(data.experiences, i, { ...x, org: ev.target.value }) })} />
                      <Input placeholder="起（如 2020-08）" value={x.start ?? ""}
                        onChange={(ev) => patch({ experiences: setAt(data.experiences, i, { ...x, start: ev.target.value }) })} />
                      <Input placeholder="止（如 2023-06）" value={x.end ?? ""}
                        onChange={(ev) => patch({ experiences: setAt(data.experiences, i, { ...x, end: ev.target.value }) })} />
                    </div>
                    <div className="mt-3">
                      <Textarea placeholder="职责 / 成果（逗号分隔技能会单独展示）" rows={2}
                        value={x.description}
                        onChange={(ev) => patch({ experiences: setAt(data.experiences, i, { ...x, description: ev.target.value }) })} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function setAt<T>(arr: T[], index: number, value: T): T[] {
  return arr.map((item, i) => (i === index ? value : item));
}
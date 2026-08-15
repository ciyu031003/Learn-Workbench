"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, User, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { GlassModal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [careerStep, setCareerStep] = useState(false);
  const [careers, setCareers] = useState<{ career_key: string; name: string; description: string | null; is_locked: boolean }[]>([]);
  const [careerBusy, setCareerBusy] = useState(false);
  const [careerErr, setCareerErr] = useState<string | null>(null);

  const pickCareer = async (key: string) => {
    setCareerBusy(true);
    setCareerErr(null);
    try {
      const r = await fetch("/api/settings/career", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career: key }),
      });
      if (!r.ok) throw new Error("保存失败");
      router.replace(from);
      router.refresh();
    } catch {
      setCareerErr("职业保存失败，请重试");
      setCareerBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "登录失败");
        setLoading(false);
        return;
      }
      // 登录成功：若未选择过职业，先弹出职业选择小窗，选择后再进入首页
      try {
        const cur = await fetch("/api/settings/career").then((x) => x.json());
        if (cur?.set) {
          router.replace(from);
          router.refresh();
          return;
        }
      } catch {
        router.replace(from);
        router.refresh();
        return;
      }
      try {
        const cData = await fetch("/api/careers").then((x) => x.json());
        setCareers(cData.careers ?? []);
      } catch {
        setCareers([]);
      }
      setCareerStep(true);
      setLoading(false);
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass glass-hover relative w-full max-w-sm overflow-hidden p-8">
        {/* 装饰光斑 */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative flex flex-col items-center gap-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_10px_30px_rgba(79,70,229,0.35)]">
            <Sparkles className="size-7" />
          </span>
          <h1 className="page-title mt-2 text-3xl font-bold">学习工作台</h1>
          <p className="page-subtitle text-sm">登录后开始你的学习旅程</p>
        </div>

        <form onSubmit={submit} className="relative mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">账号</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                autoComplete="username"
                className="h-11 pl-10"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">密码</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                className="h-11 pl-10"
              />
            </div>
          </label>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/15 px-3 py-2 text-xs text-foreground">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-[#4338ca] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition-all hover:brightness-105 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            登 录
          </button>
        </form>
        <p className="relative mt-6 text-center text-xs text-muted-foreground">账号由管理员创建 · 忘记密码请联系管理员重置</p>
</div>

      {/* 登录后职业选择小窗 */}
      <GlassModal open={careerStep} onClose={() => { if (!careerBusy) { setCareerStep(false); router.replace(from); } }} title="选择你的职业 / 学习路线">
        <p className="mb-3 text-xs text-muted-foreground">
          选择后仪表盘与学习路线将只展示该职业的规划，可在「路线图 / 设置」中随时切换
        </p>
        <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1">
          {careers.map((c) => (
            <button
              key={c.career_key}
              disabled={careerBusy}
              onClick={() => pickCareer(c.career_key)}
              className="group flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 text-left backdrop-blur-md transition-all hover:border-primary/50 hover:bg-white/15 disabled:opacity-50"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/25 text-primary">
                <CheckCircle2 className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {c.name}
                  {c.is_locked ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-muted-foreground">固定</span> : null}
                </span>
                {c.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{c.description}</span>
                ) : null}
              </span>
            </button>
          ))}
          {careers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">职业列表加载失败，请刷新重试</p>
          ) : null}
        </div>
        {careerErr ? <p className="mt-2 text-xs text-danger">{careerErr}</p> : null}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {careerBusy ? "正在保存职业路线…" : "选择后正式进入首页"}
        </p>
      </GlassModal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}


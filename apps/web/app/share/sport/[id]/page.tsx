"use client";

import { useEffect, useState, use } from "react";
import { handLabels, type SportsShare } from "@learn-workbench/shared";
import { Loader2, Share2 } from "lucide-react";

/** 公开运动档案页（无需登录）：只渲染白名单字段 */
export default function PublicSportProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SportsShare | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/sports/share/${encodeURIComponent(id)}`);
        if (!r.ok) {
          if (alive) setNotFound(true);
          return;
        }
        const d = await r.json();
        if (alive) setData(d.share ?? null);
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">档案不存在或未公开</p>
        <p className="text-sm text-muted-foreground">该运动档案可能已被设为私密</p>
      </div>
    );
  }

  const tags = [data.playStyle, data.handedness ? handLabels[data.handedness] : null, data.levelText].filter(Boolean);

  return (
    <div className="flex min-h-dvh items-start justify-center bg-slate-100/60 p-4 sm:p-8">
      {/* 运动分享卡：大面积留白 + 轻边框，克制不炫技（方案 §33） */}
      <article className="w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.10)]">
        <header className="flex items-center justify-between px-6 pt-6">
          <span className="text-sm font-black tracking-wide text-slate-900">{data.sportName}档案</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Share2 className="size-3" /> Public
          </span>
        </header>

        {data.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photoUrl} alt="" className="mt-4 h-56 w-full object-cover" />
        ) : (
          <div className="mt-4 h-32 w-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}

        <div className="flex flex-col gap-5 px-6 py-6">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{data.identity || data.displayName || "运动爱好者"}</h1>
            {data.displayName && data.identity ? (
              <p className="mt-0.5 text-xs text-slate-500">{data.displayName}</p>
            ) : null}
            {tags.length > 0 ? (
              <p className="mt-1.5 text-xs text-slate-600">{tags.join(" · ")}</p>
            ) : null}
          </div>

          {data.gear.length > 0 ? (
            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">主力装备</h2>
              <dl className="flex flex-col gap-1.5">
                {data.gear.map((g, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-dashed border-slate-100 pb-1.5 text-sm">
                    <dt className="text-slate-500">{g.label}</dt>
                    <dd className="font-semibold text-slate-900">{g.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {data.highlights.length > 0 ? (
            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">公开成绩</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.highlights.map((h, i) => (
                  <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                    {h.label} · {h.value}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <p className="pt-1 text-center text-[10px] uppercase tracking-[0.2em] text-slate-300">
            {data.sportName} Profile
          </p>
        </div>
      </article>
    </div>
  );
}
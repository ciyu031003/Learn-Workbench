"use client";

import { useEffect, useState, use } from "react";
import { computeSportsRecord, formatWinRate, gearRowWantsImage, handLabels, type SportsShare } from "@learn-workbench/shared";
import { HoloSportCardLazy } from "@/components/holo/holo-sport-card-lazy";
import { cardModelFromShare } from "@/lib/sports-card-view";
import { hasHoloArt } from "@/lib/holo-card-text";
import { Loader2, Share2, Sparkles } from "lucide-react";

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
  const record = computeSportsRecord(data);
  const holo = hasHoloArt(data.sportKey);

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

        {holo ? (
          <div className="px-3 pt-2">
            <HoloSportCardLazy model={cardModelFromShare(data)} />
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <Sparkles className="size-3" /> 实时镭射 · 拖动转卡
            </p>
          </div>
        ) : data.photoUrl ? (
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

          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">战绩</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              {([
                ["总战绩", record.matches + " 场"],
                ["胜 / 负", record.wins + " / " + record.losses],
                ["胜率", formatWinRate(record.winRate)],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2">
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="mt-0.5 text-sm font-extrabold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            {data.signatureMove ? (
              <p className="mt-2 text-center text-xs text-slate-600">绝技 · <span className="font-bold text-slate-900">{data.signatureMove}</span></p>
            ) : null}
          </section>

          {data.gear.length > 0 ? (
            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">主力装备</h2>
              <dl className="flex flex-col gap-1.5">
                {data.gear.map((g, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b border-dashed border-slate-100 pb-1.5 text-sm">
                    <dt className="flex min-w-0 items-center gap-2 text-slate-500">
                      {data.showGearImages && g.imageUrl && gearRowWantsImage(g.label) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.imageUrl}
                          alt=""
                          className="size-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
                        />
                      ) : null}
                      {g.label}
                    </dt>
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
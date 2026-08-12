"use client";

import { useEffect, useState } from "react";
import type { BackgroundInfo } from "@learn-workbench/shared";
import { useUiStore } from "@/store/ui-store";

export function DailyBackground({ children }: { children: React.ReactNode }) {
  const enabled = useUiStore((s) => s.backgroundEnabled);
  const [bg, setBg] = useState<BackgroundInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/background")
      .then((r) => (r.ok ? (r.json() as Promise<BackgroundInfo>) : null))
      .then((d) => {
        if (alive) setBg(d);
      })
      .catch(() => {
        if (alive) setBg(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const show = enabled && bg?.exists;

  return (
    <div className="relative min-h-screen">
      {show ? (
        <div className="fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/background/img?date=${encodeURIComponent(bg.date)}`}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/45" />
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-slate-50 to-cyan-50" />
      )}
      <div className="relative z-0">{children}</div>
    </div>
  );
}

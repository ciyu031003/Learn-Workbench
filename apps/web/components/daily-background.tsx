"use client";

import { useEffect, useState } from "react";
import type { BackgroundInfo } from "@learn-workbench/shared";
import { useUiStore } from "@/store/ui-store";

/** 根据背景图片平均亮度切换文字对比度（暗图 → 白字，亮图 → 深字） */
function applyBrightnessTone(imgSrc: string) {
  const img = new Image();
  img.src = imgSrc;
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 14;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 24, 14);
      const data = ctx.getImageData(0, 0, 24, 14).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avg = sum / (24 * 14);
      document.documentElement.classList.toggle("bg-dark", avg < 132);
    } catch {
      document.documentElement.classList.remove("bg-dark");
    }
  };
  img.onerror = () => document.documentElement.classList.remove("bg-dark");
}

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

  useEffect(() => {
    if (show && bg) {
      applyBrightnessTone(`/api/background/img?date=${encodeURIComponent(bg.date)}`);
    } else {
      document.documentElement.classList.remove("bg-dark");
    }
  }, [show, bg]);

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
          {/* 暖调黄昏遮罩：保留原图氛围，同时保证文字可读 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-orange-950/35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,180,110,0.14),transparent_55%)]" />
          {/* 液态玻璃环境光斑 */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="ambient-blob ambient-blob-1" />
            <div className="ambient-blob ambient-blob-2" />
            <div className="ambient-blob ambient-blob-3" />
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100" />
      )}
      <div className="relative z-0">{children}</div>
    </div>
  );
}


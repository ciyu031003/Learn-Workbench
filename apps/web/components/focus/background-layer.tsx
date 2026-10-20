"use client";

import { useEffect, useState } from "react";
import { FOCUS_GALLERY, useFocusBgStore } from "@/store/focus-bg-store";

/** 全屏专注背景层（图库/纯色/上传；Bing 当日图异步取）。S8-a 从 focus-timer.tsx 原样搬出。 */
export function FocusBackgroundLayer() {
  const { mode, color, uploadUrl, galleryId } = useFocusBgStore();
  const [bing, setBing] = useState<string | null>(null);

  useEffect(() => {
    if (!(mode === "gallery" && galleryId === "bing")) return;
    let alive = true;
    fetch("/api/background")
      .then((r) => (r.ok ? (r.json() as Promise<{ exists?: boolean; date?: string }>) : null))
      .then((d) => {
        if (alive && d?.exists && d.date) setBing(`/api/background/img?date=${encodeURIComponent(d.date)}`);
        else setBing(null);
      })
      .catch(() => setBing(null));
    return () => {
      alive = false;
    };
  }, [mode, galleryId]);

  if (mode === "color") {
    return <div className="absolute inset-0" style={{ backgroundColor: color }} />;
  }
  if (mode === "upload" && uploadUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={uploadUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (mode === "gallery" && galleryId === "bing") {
    if (bing) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={bing} alt="" className="absolute inset-0 h-full w-full object-cover" />;
    }
    return <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />;
  }
  const g = FOCUS_GALLERY.find((x) => x.id === galleryId) ?? FOCUS_GALLERY[0];
  return <div className="absolute inset-0" style={{ background: g.css }} />;
}

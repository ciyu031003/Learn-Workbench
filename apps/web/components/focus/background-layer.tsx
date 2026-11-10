"use client";

import { useEffect, useState } from "react";
import { FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";
import { useFocusBgStore } from "@/store/focus-bg-store";
import { focusSceneImage } from "@/lib/focus-scene";

/** Fullscreen focus background: scene photo, custom upload, color, or daily Bing. */
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

  // Persisted preferences from older releases may contain gallery ids that no
  // longer exist. Always render a real scene instead of an empty gradient.
  const scene = FOCUS_SCENES.find((item) => item.id === galleryId) ?? FOCUS_SCENES[0];
  return (
    <div className="absolute inset-0" style={{ background: scene.gradient }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={focusSceneImage(scene.id)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
    </div>
  );
}

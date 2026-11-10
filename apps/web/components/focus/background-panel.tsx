"use client";

import { useRef } from "react";
import { ImagePlus, Images, Palette } from "lucide-react";
import { FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";
import { FOCUS_COLORS, useFocusBgStore } from "@/store/focus-bg-store";
import { cn } from "@/lib/utils";
import { focusSceneImage } from "@/lib/focus-scene";

/** Background settings: built-in scenes, solid color, or a local image. */
export function FocusBackgroundPanel({ open }: { open: boolean }) {
  const bg = useFocusBgStore();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const onUpload = (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      alert("图片较大，请选择 3MB 以内的图片");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      bg.setUploadUrl(String(reader.result));
      bg.setMode("upload");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative z-10 mx-auto mt-3 w-[min(94vw,480px)] rounded-2xl border border-white/20 bg-black/45 p-4 text-white shadow-2xl backdrop-blur-2xl">
      <div className="mb-3 flex items-center gap-2">
        {[
          { key: "gallery", label: "场景", icon: Images },
          { key: "color", label: "纯色", icon: Palette },
          { key: "upload", label: "自定义", icon: ImagePlus },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => bg.setMode(m.key as "gallery" | "color" | "upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs transition-all",
              bg.mode === m.key
                ? "border-white/50 bg-white/20 text-white"
                : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
            )}
          >
            <m.icon className="size-3.5" /> {m.label}
          </button>
        ))}
      </div>
      {bg.mode === "color" ? (
        <div className="flex flex-wrap gap-2">
          {FOCUS_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => bg.setColor(c)}
              className={cn(
                "h-9 w-9 rounded-full border-2 transition-all",
                bg.color === c ? "scale-110 border-white" : "border-white/30"
              )}
              style={{ backgroundColor: c }}
              aria-label={`背景色 ${c}`}
            />
          ))}
          <label className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 text-xs text-white/80">
            自定义
            <input
              type="color"
              value={bg.color}
              onChange={(e) => bg.setColor(e.target.value)}
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      ) : null}
      {bg.mode === "upload" ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white/90 transition-all hover:bg-white/20"
          >
            <ImagePlus className="size-4" /> 选择本地图片（≤3MB）
          </button>
          {bg.uploadUrl ? (
            <p className="text-center text-xs text-white/60">已上传自定义背景，点击上方可更换</p>
          ) : null}
        </div>
      ) : null}
      {bg.mode === "gallery" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FOCUS_SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => bg.setGalleryId(scene.id)}
              className={cn(
                "relative h-20 overflow-hidden rounded-xl border text-left transition-all",
                bg.galleryId === scene.id
                  ? "border-white ring-2 ring-white/40"
                  : "border-white/20 hover:border-white/50"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={focusSceneImage(scene.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-xs font-semibold text-white">{scene.name}</span>
            </button>
          ))}
          <button
            onClick={() => bg.setGalleryId("bing")}
            className={cn(
              "relative h-20 overflow-hidden rounded-xl border bg-gradient-to-br from-slate-700 to-slate-950 text-left transition-all",
              bg.galleryId === "bing"
                ? "border-white ring-2 ring-white/40"
                : "border-white/20 hover:border-white/50"
            )}
          >
            <span className="absolute bottom-2 left-2.5 text-xs font-semibold text-white">每日 Bing</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

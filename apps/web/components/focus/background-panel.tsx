"use client";

import { useRef } from "react";
import { ImagePlus, Images, Palette } from "lucide-react";
import { FOCUS_COLORS, FOCUS_GALLERY, useFocusBgStore } from "@/store/focus-bg-store";
import { cn } from "@/lib/utils";

/** 背景设置面板（图库/纯色/自定义上传）。S8-a 从 focus-timer.tsx 原样搬出。 */
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
    <div className="glass relative z-10 mx-auto mt-3 w-[min(92vw,420px)] rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        {[
          { key: "gallery", label: "默认图库", icon: Images },
          { key: "color", label: "纯色", icon: Palette },
          { key: "upload", label: "自定义图片", icon: ImagePlus },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => bg.setMode(m.key as "gallery" | "color" | "upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs transition-all",
              bg.mode === m.key
                ? "border-primary/60 bg-primary/25 text-foreground"
                : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15"
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
        <div className="grid grid-cols-4 gap-2">
          {FOCUS_GALLERY.map((g) => (
            <button
              key={g.id}
              onClick={() => bg.setGalleryId(g.id)}
              className={cn(
                "flex h-14 items-center justify-center overflow-hidden rounded-xl border text-[11px] text-white transition-all",
                bg.galleryId === g.id ? "border-white ring-2 ring-primary/50" : "border-white/20"
              )}
              style={g.css ? { background: g.css } : { background: "linear-gradient(135deg,#1e293b,#0f172a)" }}
            >
              {g.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

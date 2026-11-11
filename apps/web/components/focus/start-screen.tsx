"use client";

import { Headphones, Play, Target, Volume2 } from "lucide-react";
import { FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";
import { cn } from "@/lib/utils";
import { useFocusBgStore } from "@/store/focus-bg-store";
import { focusSceneImage } from "@/lib/focus-scene";

const PRESETS = [25, 45, 50, 90];

/** Pre-session room: choose a scene, set sound, then pick a pomodoro length. */
export function StartScreen({
  sessionLabel,
  mode,
  timerMode,
  minutes,
  onChangeTimerMode,
  onPickPreset,
  onBegin,
}: {
  sessionLabel: string;
  mode: "focus" | "exercise";
  timerMode: "countdown" | "stopwatch";
  minutes: number;
  onChangeTimerMode: (mode: "countdown" | "stopwatch") => void;
  onPickPreset: (m: number) => void;
  onBegin: () => void;
}) {
  const bg = useFocusBgStore();
  const activeScene = FOCUS_SCENES.find((scene) => scene.id === bg.galleryId) ?? FOCUS_SCENES[0];

  return (
    <div className="relative z-10 flex flex-1 overflow-y-auto px-4 pb-6 pt-3">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/65">FOCUS ROOM</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">专注室</h1>
            <p className="mt-1 text-sm text-white/55">{sessionLabel} · 选一个今天想待的地方</p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/75 backdrop-blur-md">
            {activeScene.name}
          </span>
        </header>

        <div className="grid gap-4 landscape:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-white/20 bg-white/[0.06] p-4 backdrop-blur-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70">STEP 01</p>
            <h2 className="mt-1 text-xl font-semibold text-white">选择你的学习场景</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {FOCUS_SCENES.map((scene) => {
                const active = bg.galleryId === scene.id && bg.mode === "gallery";
                return (
                  <button
                    key={scene.id}
                    onClick={() => {
                      bg.setMode("gallery");
                      bg.setGalleryId(scene.id);
                    }}
                    className={cn(
                      "group relative aspect-[16/10] overflow-hidden rounded-xl border text-left transition-all",
                      active
                        ? "border-white/85 ring-2 ring-white/30"
                        : "border-white/20 hover:border-white/55"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={focusSceneImage(scene.id)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                    <span className="absolute inset-x-2.5 bottom-2 flex flex-col">
                      <span className="text-sm font-semibold text-white">{scene.name}</span>
                      <span className="truncate text-[11px] text-white/70">{scene.tagline}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-white/20 bg-white/[0.06] p-4 backdrop-blur-2xl">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70">STEP 02</p>
              <h2 className="mt-1 text-xl font-semibold text-white">设置声音氛围</h2>
              <div className="mt-3 space-y-2.5">
                <label className="block rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-white/85">
                    <Headphones className="size-3.5" /> 音乐
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/65">Lo-fi、轻音乐、钢琴等专注音乐</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bg.musicVolume}
                    onChange={(e) => bg.setMusicVolume(Number(e.target.value))}
                    className="mt-2 w-full accent-white"
                    aria-label="音乐音量"
                  />
                </label>
                <label className="block rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-white/85">
                    <Volume2 className="size-3.5" /> 背景音
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-white/45">{activeScene.soundscape}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bg.ambientVolume}
                    onChange={(e) => bg.setAmbientVolume(Number(e.target.value))}
                    className="mt-2 w-full accent-white"
                    aria-label="背景音量"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-white/20 bg-white/[0.06] p-4 backdrop-blur-2xl">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70">STEP 03</p>
              <h2 className="mt-1 text-xl font-semibold text-white">设置番茄钟</h2>

              <label className="mt-3 flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3.5 py-2">
                <Target className="size-3.5 shrink-0 text-white/70" />
                <input
                  value={bg.goal}
                  onChange={(e) => bg.setGoal(e.target.value)}
                  placeholder="今日目标 · 写下今天想完成的事…"
                  maxLength={60}
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (timerMode !== "countdown") onChangeTimerMode("countdown");
                      onPickPreset(m);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-2.5 text-xs font-medium transition-all",
                      timerMode === "countdown" && minutes === m
                        ? "border-white/65 bg-white/20 text-white"
                        : "border-white/15 bg-white/[0.05] text-white/70 hover:bg-white/10"
                    )}
                  >
                    {m} 分钟
                  </button>
                ))}
              </div>
              {mode === "focus" ? (
                <div className="mt-3 flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.05] p-1">
                  {(
                    [
                      { key: "countdown", label: "倒计时" },
                      { key: "stopwatch", label: "正向秒表" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => onChangeTimerMode(o.key)}
                      className={cn(
                        "flex-1 rounded-full px-3 py-1.5 text-xs transition-all",
                        timerMode === o.key ? "bg-white/20 text-white" : "text-white/55 hover:text-white"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                onClick={onBegin}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/40 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-white"
              >
                <Play className="size-4" />
                {mode === "exercise" ? "开始运动" : timerMode === "stopwatch" ? "开始计时" : "进入自习室"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 学习内容仓库（移动端）：**数据库为源**，App 只做读取 + 模板渲染。
 *
 * 口径：
 *   - 启动时 `hydrateLearningContent()` 拉一次 `GET /api/learning/content`（库里的课程/阶段/
 *     知识点/讲义/题目），成功后替换内存快照并通知订阅者重渲染；
 *   - 拉取失败或尚未拉到 → 先用内置内容包兜底（离线/弱网也能看，不白屏）；
 *   - 组件通过 `useLearningTracks()` / `useLearningTrack(slug)` 订阅，内容一变即刷新。
 *
 * 这样"改内容只改库"，App 不需要跟着发版；内置内容包退化为纯离线兜底。
 */
import { useMemo, useSyncExternalStore } from "react";
import { algorithmAnimations as bundledAnimations, learningTracks as bundledTracks } from "@learn-workbench/content/learning";
import type { LearningTrack } from "@learn-workbench/content/types";
import { getApiUrl } from "@/config";

export interface AnimationFrame {
  caption: string;
  svg: string;
}
export type AnimationFrames = Record<string, AnimationFrame[]>;

let tracks: LearningTrack[] = bundledTracks;
let animations: AnimationFrames = bundledAnimations as AnimationFrames;
let hydrated = false;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeLearningContent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 当前快照（同步读取；未 hydrate 时是内置内容包）。 */
export function getLearningTracksSnapshot(): LearningTrack[] {
  return tracks;
}

/** 算法动图帧（库里没有该 key 时回退内置内容包）。 */
export function getAnimationFrames(): AnimationFrames {
  return animations;
}

export function useAnimationFrames(): AnimationFrames {
  return useSyncExternalStore(subscribeLearningContent, getAnimationFrames, getAnimationFrames);
}

export function getLearningTrackNow(slug: string | null | undefined): LearningTrack | null {
  if (!slug) return null;
  return tracks.find((track) => track.slug === slug) ?? null;
}

export function useLearningTracks(): LearningTrack[] {
  return useSyncExternalStore(subscribeLearningContent, getLearningTracksSnapshot, getLearningTracksSnapshot);
}

export function useLearningTrack(slug: string | null | undefined): LearningTrack | null {
  const all = useLearningTracks();
  return useMemo(() => (slug ? all.find((track) => track.slug === slug) ?? null : null), [all, slug]);
}

export function useLearningCategories(): string[] {
  const all = useLearningTracks();
  return useMemo(() => [...new Set(all.map((track) => track.category))], [all]);
}

/** 拉取数据库内容（幂等；并发调用共享同一个请求）。返回是否成功拿到库里的内容。 */
export async function hydrateLearningContent(): Promise<boolean> {
  if (hydrated) return true;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch(getApiUrl() + "/api/learning/content");
      if (!response.ok) return false;
      const data = (await response.json()) as { tracks?: LearningTrack[]; animations?: AnimationFrames };
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        tracks = data.tracks;
        if (data.animations && Object.keys(data.animations).length > 0) animations = data.animations;
        hydrated = true;
        emit();
        return true;
      }
      return false;
    } catch {
      return false; // 离线/弱网：保持内置内容包
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 测试用：重置状态（可注入夹具）。 */
export function __resetLearningContentForTest(next?: LearningTrack[]): void {
  tracks = next ?? bundledTracks;
  animations = bundledAnimations as AnimationFrames;
  hydrated = false;
  inflight = null;
  emit();
}

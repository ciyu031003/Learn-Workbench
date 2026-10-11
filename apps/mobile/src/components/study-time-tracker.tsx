import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";

import {
  autoStudySegmentSeconds,
  autoStudyZoneForPathname,
  type AutoStudyZone,
} from "@/lib/auto-study-timer";
import { useAppStore } from "@/store/app-store";

/**
 * 根级自动计时器：进入题库/面试即开始，离开或退到后台立即结算。
 * 现有学习统计只认 focus_sessions，因此这里直接走 addSession，不新增统计口径。
 */
export function StudyTimeTracker() {
  const pathname = usePathname();
  const addSession = useAppStore((state) => state.addSession);
  const activeZoneRef = useRef<AutoStudyZone | null>(null);
  const segmentStartedAtRef = useRef<number | null>(null);
  const appActiveRef = useRef(AppState.currentState === "active");
  const addSessionRef = useRef(addSession);

  useEffect(() => {
    addSessionRef.current = addSession;
  }, [addSession]);

  const flushSegment = useCallback(() => {
    const zone = activeZoneRef.current;
    const startedAt = segmentStartedAtRef.current;
    segmentStartedAtRef.current = null;
    if (!zone || startedAt === null) return;

    const seconds = autoStudySegmentSeconds(startedAt, Date.now());
    if (seconds > 0) {
      addSessionRef.current(null, seconds, zone.label);
    }
  }, []);

  const pause = useCallback(() => {
    flushSegment();
  }, [flushSegment]);

  const resume = useCallback(() => {
    if (appActiveRef.current && activeZoneRef.current && segmentStartedAtRef.current === null) {
      segmentStartedAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    const nextZone = autoStudyZoneForPathname(pathname);
    if (activeZoneRef.current?.key === nextZone?.key) return;

    flushSegment();
    activeZoneRef.current = nextZone;
    segmentStartedAtRef.current = nextZone && appActiveRef.current ? Date.now() : null;
  }, [flushSegment, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      appActiveRef.current = active;
      if (active) resume();
      else pause();
    });
    return () => {
      subscription.remove();
      pause();
    };
  }, [pause, resume]);

  return null;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAppStore } from "@/store/app-store";
import { useFocusSessionStore } from "@/store/focus-session-store";
import { createStudyClock, shouldRecordStudy } from "./study-timer";

/**
 * 页面级学习计时（v2.6.10）：
 * - 页面聚焦即开始，失焦 / 退到后台 / 打开全屏专注时结算；
 * - 单次 ≥30 秒才写入 focus_sessions（tag = 内容名），与专注计时共用统计口径；
 * - 已打开全屏 / 悬浮专注时不重复计时，避免同一段时间记两次；
 * - 每 15 秒刷新页面上的「本次已学 X 分钟」。
 */
export function useStudyTimer(label: string | null | undefined, enabled = true) {
  const addSession = useAppStore((s) => s.addSession);
  const focusOpen = useFocusSessionStore((s) => s.open);
  const clockRef = useRef(createStudyClock());
  const labelRef = useRef<string | null>(null);
  const focusedRef = useRef(false);
  const focusOpenRef = useRef(false);
  const enabledRef = useRef(enabled);
  const appActiveRef = useRef(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [seconds, setSeconds] = useState(0);

  // 内容名可能晚于首帧到达（接口返回后才拿到标题），用 ref 保持结算时读最新值。
  useEffect(() => {
    labelRef.current = label?.trim() ? label.trim().slice(0, 40) : null;
  }, [label]);

  const settle = useCallback(() => {
    const secs = clockRef.current.stop();
    setSeconds(0);
    if (shouldRecordStudy(secs)) addSession(null, secs, labelRef.current);
  }, [addSession]);

  const sync = useCallback(() => {
    const shouldRun = focusedRef.current && enabledRef.current && appActiveRef.current && !focusOpenRef.current;
    if (shouldRun) clockRef.current.start();
    else settle();
  }, [settle]);

  useEffect(() => {
    enabledRef.current = enabled;
    sync();
  }, [enabled, sync]);

  useEffect(() => {
    focusOpenRef.current = focusOpen;
    sync();
  }, [focusOpen, sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const next = state === "active";
      if (appActiveRef.current === next) return;
      appActiveRef.current = next;
      sync();
    });
    return () => subscription.remove();
  }, [sync]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      sync();
      return () => {
        focusedRef.current = false;
        settle();
      };
    }, [settle, sync]),
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (clockRef.current.running()) setSeconds(clockRef.current.elapsed());
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return { seconds };
}

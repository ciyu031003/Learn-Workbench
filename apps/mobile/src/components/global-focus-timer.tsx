import { useEffect } from "react";
import { FocusTimer } from "@/components/focus-timer";
import { useAppStore } from "@/store/app-store";
import { useFocusSessionStore } from "@/store/focus-session-store";

/**
 * 根级单实例专注计时。
 * today / tasks 只调用 useFocusSessionStore.openFocus()，由这里统一挂载 FocusTimer；
 * 因此收起为悬浮计时后切 Tab / 进子页，计时引擎都不会被卸载。
 */
export function GlobalFocusTimer() {
  const open = useFocusSessionStore((s) => s.open);
  const minimized = useFocusSessionStore((s) => s.minimized);
  const sessionKey = useFocusSessionStore((s) => s.sessionKey);
  const config = useFocusSessionStore((s) => s.config);
  const minimize = useFocusSessionStore((s) => s.minimize);
  const restore = useFocusSessionStore((s) => s.restore);
  const close = useFocusSessionStore((s) => s.close);
  const setSnapshot = useFocusSessionStore((s) => s.setSnapshot);
  const sessions = useAppStore((s) => s.sessions);
  const addSession = useAppStore((s) => s.addSession);
  const addSportSeconds = useAppStore((s) => s.addSportSeconds);

  // 收起后在后台自然完成：自动恢复全屏完成页，让用户看到庆祝与结果
  const shouldRestoreDone = useFocusSessionStore(
    (s) => s.minimized && s.snapshot?.status === "done"
  );
  useEffect(() => {
    if (shouldRestoreDone) restore();
  }, [shouldRestoreDone, restore]);

  if (!open || !config) return null;

  return (
    <FocusTimer
      key={sessionKey}
      open={open}
      minimized={minimized}
      task={config.task}
      sessions={sessions}
      autoStart={config.autoStart}
      initialTimerMode={config.initialTimerMode}
      initialMinutes={config.initialMinutes}
      mode={config.mode ?? "focus"}
      exerciseLabel={config.exerciseLabel ?? null}
      contentLabel={config.contentLabel ?? null}
      onClose={close}
      onMinimize={minimize}
      onSnapshot={setSnapshot}
      onRecorded={(taskId, seconds, label) =>
        addSession(taskId, seconds, label ?? (taskId ? config.task?.title ?? null : null))
      }
      onExerciseRecorded={(seconds) => {
        if (config.sportKey) addSportSeconds(config.sportKey, seconds);
      }}
    />
  );
}

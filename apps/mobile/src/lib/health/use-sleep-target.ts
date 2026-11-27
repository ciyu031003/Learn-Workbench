import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { fetchHealthProfile } from "./health-client";

export const DEFAULT_SLEEP_TARGET_MIN = 450;

// 进程内缓存：睡眠页 / 成长页都会用，避免各自重复请求
let cachedToken: string | null | undefined;
let cachedTarget: number | null = null;
let inflight: Promise<number> | null = null;
const listeners = new Set<(value: number) => void>();

function publish(value: number) {
  cachedTarget = value;
  listeners.forEach((listener) => listener(value));
}

async function loadTarget(token: string | null): Promise<number> {
  if (cachedToken === token && cachedTarget !== null) return cachedTarget;
  if (!inflight) {
    inflight = fetchHealthProfile(token)
      .then((res) => {
        const value = Number(res.profile.sleepTargetMinutes);
        const safe = Number.isFinite(value) && value >= 300 && value <= 720 ? Math.round(value) : DEFAULT_SLEEP_TARGET_MIN;
        cachedToken = token;
        publish(safe);
        return safe;
      })
      .catch(() => DEFAULT_SLEEP_TARGET_MIN)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** 健康基线保存后调用：直接把最新目标推给所有已挂载页面，避免重复请求 */
export function syncSleepTarget(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 300 || minutes > 720) return;
  publish(Math.round(minutes));
}

/** 退出登录 / 切换账号时清缓存 */
export function invalidateSleepTarget() {
  cachedToken = undefined;
  cachedTarget = null;
  inflight = null;
}

/** 用户设置的每日睡眠目标（分钟）；接口不可用时回落到 7.5 小时 */
export function useSleepTarget(): number {
  const token = useAppStore((s) => s.token);
  const [target, setTarget] = useState<number>(cachedToken === token && cachedTarget !== null ? cachedTarget : DEFAULT_SLEEP_TARGET_MIN);
  useEffect(() => {
    let active = true;
    const listener = (value: number) => {
      if (active) setTarget(value);
    };
    listeners.add(listener);
    void loadTarget(token).then((value) => {
      if (active) setTarget(value);
    });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [token]);
  return target;
}

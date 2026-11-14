import { useCallback, useMemo, useState } from "react";
import {
  celebrationCopy,
  celebrationDayKey,
  type CelebrationContext,
  type CelebrationCopy,
  type CelebrationKind,
} from "@/lib/celebration-core";
import { claimCelebration } from "@/lib/celebration-state";
import type { CelebrationTone } from "@/lib/celebration-copy";

export interface CelebrationRequest extends CelebrationCopy {
  kind: CelebrationKind;
  tone?: CelebrationTone;
}

/**
 * 页面级庆祝控制器（统一入口）。
 *
 * - `celebrate()`：用户主动完成的动作，每次都反馈（如做完一组练习）；
 * - `celebrateOnce()`：系统判定的里程碑，按「kind + eventId + 当天」去重
 *   （如今日计划全部完成、408 每日 20 张）。退出重进不会重复弹。
 */
export function useCelebration() {
  const [request, setRequest] = useState<CelebrationRequest | null>(null);

  const celebrate = useCallback(
    (kind: CelebrationKind, ctx?: CelebrationContext, tone?: CelebrationTone) => {
      setRequest({ ...celebrationCopy(kind, ctx), kind, tone });
    },
    [],
  );

  const celebrateOnce = useCallback(
    async (kind: CelebrationKind, eventId: string, ctx?: CelebrationContext, tone?: CelebrationTone) => {
      const claimed = await claimCelebration(kind, eventId, celebrationDayKey());
      if (!claimed) return false;
      setRequest({ ...celebrationCopy(kind, ctx), kind, tone });
      return true;
    },
    [],
  );

  const close = useCallback(() => setRequest(null), []);

  return useMemo(
    () => ({ request, celebrate, celebrateOnce, close }),
    [request, celebrate, celebrateOnce, close],
  );
}

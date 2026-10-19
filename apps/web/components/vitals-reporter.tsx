"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { readNavigatorHints } from "@/lib/device-capability";
import {
  WEB_VITAL_NAMES,
  rateVital,
  resolveMotionTier,
  sanitizeRoute,
  shouldSampleVitals,
  type WebVitalName,
} from "@/lib/vitals";

interface NavigatorWithConnection extends Navigator {
  connection?: { effectiveType?: string; saveData?: boolean };
}

function connectionHints(): { effectiveType?: string; saveData?: boolean } {
  if (typeof navigator === "undefined") return {};
  const conn = (navigator as NavigatorWithConnection).connection;
  return { effectiveType: conn?.effectiveType, saveData: conn?.saveData };
}

/**
 * 首屏动效分档 + Web Vitals 采样上报（S6-8）。
 *
 * 1) 动效分档：按 prefers-reduced-motion 与设备能力（核数/内存/省流）写 html[data-motion]，
 *    globals.css 据此关掉无限装饰动画与毛玻璃（低端机首屏少掉帧）；
 * 2) Vitals：useReportWebVitals 采样 LCP/CLS/INP/FCP/TTFB，20% 采样、省流/2G 跳过，
 *    只上报 {name,value,rating,脱敏 route}，**不带用户标识、不带 query**；
 * 3) 仅生产环境上报（本地开发噪音大且没有抓取价值）。
 *
 * 隐私：服务端只做计数/均值/最大值聚合（lib/vitals.ts），不落单条事件。
 */
export function VitalsReporter() {
  // ---- 动效分档 ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const apply = () => {
      const hints = readNavigatorHints();
      const conn = connectionHints();
      const tier = resolveMotionTier({
        prefersReducedMotion: Boolean(mq?.matches),
        hardwareConcurrency: hints.hardwareConcurrency,
        deviceMemory: hints.deviceMemory,
        saveData: hints.saveData ?? conn.saveData,
      });
      document.documentElement.dataset.motion = tier;
    };
    apply();
    // 系统在运行中切换 reduced-motion 时同步（用户随时可能打开"减弱动态效果"）
    mq?.addEventListener("change", apply);
    return () => mq?.removeEventListener("change", apply);
  }, []);

  // ---- Web Vitals 采样 ----
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    const name = metric.name as WebVitalName;
    if (!WEB_VITAL_NAMES.includes(name)) return;
    if (!Number.isFinite(metric.value)) return;

    const conn = connectionHints();
    const hints = readNavigatorHints();
    if (
      !shouldSampleVitals({
        saveData: hints.saveData ?? conn.saveData,
        effectiveType: conn.effectiveType,
        hardwareConcurrency: hints.hardwareConcurrency,
      })
    ) {
      return;
    }

    const payload = JSON.stringify({
      name,
      value: metric.value,
      rating: rateVital(name, metric.value),
      route: sanitizeRoute(window.location.pathname),
      navigationType: metric.navigationType,
    });
    // 单条样本必须很小；超限说明字段异常，直接放弃（不放大请求）
    if (payload.length > 512) return;

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/internal/vitals", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/internal/vitals", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        });
      }
    } catch {
      // 上报失败静默：指标不能影响业务
    }
  });

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * 公开/轻量区错误边界（评审 2026-10-31 P2）：此前只有 (app) 组有 error.tsx，
 * (public)/(learn) 的客户端组件抛异常会落到 Next 默认英文错误页——
 * 匿名读者从分享链接进来就"出不去"，违背公开页的设计目标。
 * 文案对匿名访客措辞（不带登录区语境），样式与 (app)/error.tsx 一致。
 */
export default function PublicGroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 只记受限信息：页面错误可能含用户数据，不把 message 直接上报/展示
    console.error("[public] page error", { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">这块内容加载失败了</h1>
      <p className="max-w-md text-sm text-[var(--color-muted-foreground)]">
        可能是网络波动或服务暂时不可用。重试通常就能恢复；如果反复失败，请稍后再来。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm text-white"
      >
        重试
      </button>
    </div>
  );
}

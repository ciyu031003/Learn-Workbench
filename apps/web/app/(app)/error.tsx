"use client";

import { useEffect } from "react";

/** 登录区错误边界（S3-3）：客户端异常不再整页崩成 Next 默认英文错误页 */
export default function AppGroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 只记受限信息：页面错误可能含用户数据，不把 message 直接上报/展示
    console.error("[app] page error", { digest: error.digest });
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

import Link from "next/link";

/** 全站中文 404（S3-3 顺带补齐，此前命中 Next 内置英文页） */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] px-6 text-center text-[var(--color-text)]">
      <p className="text-sm font-medium text-[var(--color-muted-foreground)]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">这个页面不存在</h1>
      <p className="max-w-md text-sm text-[var(--color-muted-foreground)]">
        链接可能已失效，或者内容被移动了。可以回到首页或直接进入工作台。
      </p>
      <div className="mt-2 flex gap-3 text-sm">
        <Link className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-white" href="/">
          回到首页
        </Link>
        <Link className="rounded-full border px-4 py-2" href="/dashboard">
          进入工作台
        </Link>
      </div>
    </div>
  );
}

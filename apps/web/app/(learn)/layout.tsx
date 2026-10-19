import Link from "next/link";

/**
 * 学习内容区路由组（S3-3）：公开只读内容，不挂 AppShell（省 200KB+ 客户端 shell 体积），
 * 只保留一条轻量服务端导航，避免匿名读者"进来出不去"。
 */
export default function LearnGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-sm">
        <Link href="/learn" className="font-semibold tracking-tight">
          学习内容库
        </Link>
        <nav className="flex items-center gap-4 text-[var(--color-muted-foreground)]">
          <Link href="/" className="hover:text-[var(--color-text)]">
            首页
          </Link>
          <Link href="/dashboard" className="hover:text-[var(--color-text)]">
            工作台
          </Link>
          <Link href="/login" className="hover:text-[var(--color-text)]">
            登录
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
    </div>
  );
}

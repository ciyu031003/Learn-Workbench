"use client";

import Image from "next/image";
import Link from "next/link";
import { Download } from "@/components/shell/icons";

/** 移动端顶栏（毛玻璃）。下载入口随 NEXT_PUBLIC_DOWNLOAD_URL 是否存在显示/隐藏。 */
export function MobileTopBar({ date, downloadUrl }: { date: string; downloadUrl: string | null }) {
  return (
    <header className="surface-nav app-mobile-topbar sticky top-0 z-30 h-14 items-center justify-between border-b px-4">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image src="/app-icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
        <span className="text-sm font-semibold text-foreground">学习工作台</span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{date}</span>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Download className="size-4" />
            下载
          </a>
        ) : null}
      </div>
    </header>
  );
}

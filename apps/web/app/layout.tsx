import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: { default: "学习工作台", template: "%s · 学习工作台" },
  description: "学习路线图追踪 + 学习规划工作台：路线图、每日任务、专注计时、费曼日志、证书与简历资产。",
};

/**
 * 视口（skill P5：显式声明 viewport，且不禁止缩放）。
 *
 * - `width=device-width, initial-scale=1` 是移动端布局的基线；
 * - **不设** maximumScale / userScalable —— 禁用缩放会破坏低视力用户的可访问性（WCAG 1.4.4）；
 * - themeColor 让浏览器地址栏跟随明暗主题，避免状态栏与页面撞色。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

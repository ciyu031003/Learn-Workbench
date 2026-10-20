import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * 主题防闪（FOUC）脚本读取的 localStorage key。
 *
 * 必须与 `store/ui-store.ts` 的 persist `name` 完全一致（当前 "lwb-web-ui"），
 * 也与 `lib/theme.test.ts` 的断言一致 —— 三者任一改名都要同步改，否则刷新会回浅色。
 */
const THEME_STORAGE_KEY = "lwb-web-ui";

/**
 * 首屏内联脚本（同步、static 字符串，不依赖任何客户端包）。
 *
 * 在 `<head>` 里执行，早于 body 绘制：读 localStorage 里 zustand persist 的
 * `{ state: { theme } }`，按 light/dark/auto + 系统偏好预置 `html.dark`，
 * 避免"先渲染浅色再切深色"的闪动。判定规则与 `components/theme-provider.tsx`
 * 的 `resolveIsDark` 一致（默认 light，auto 跟随 prefers-color-scheme）。
 */
const THEME_INIT_SCRIPT = `(function(){try{var theme="light";var raw=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.state&&typeof parsed.state.theme==="string"){theme=parsed.state.theme;}}var prefersDark=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches;var root=document.documentElement;root.classList.toggle("dark",theme==="dark"||(theme==="auto"&&prefersDark));root.classList.remove("bg-dark");}catch(e){}})();`;

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
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* 防闪：同步给 <html> 预置 dark 类，早于首屏绘制（与 store persist key 一致） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {/* S8-c：ThemeProvider 只在登录区异步挂载（内联脚本已预置首屏主题，公开页无需客户端主题同步） */}
        {/* S7：VitalsReporter 移到 (app) 组（公开页不背 ~9KB 客户端包；公开页也不需要动效分档） */}
        {children}
      </body>
    </html>
  );
}

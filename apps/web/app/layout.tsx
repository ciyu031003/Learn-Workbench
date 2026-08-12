import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DailyBackground } from "@/components/daily-background";

export const metadata: Metadata = {
  title: { default: "ICT 学习工作台", template: "%s · ICT 学习工作台" },
  description: "学习路线图追踪 + 学习规划工作台：路线图、每日任务、专注计时、费曼日志、证书与简历资产。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <DailyBackground>
          <AppShell>{children}</AppShell>
        </DailyBackground>
      </body>
    </html>
  );
}

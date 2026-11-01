import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Film, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getExam408Demos, groupExam408Demos } from "@/lib/exam-408-demos";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」：演示目录页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Exam408VizPage() {
  const demos = await getExam408Demos();
  const groups = groupExam408Demos(demos);
  const totalSteps = demos.reduce((sum, demo) => sum + demo.stepsCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <span className="text-foreground">演示目录</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">交互演示</Badge>
            <Badge variant="outline">{demos.length} 个演示</Badge>
            <Badge variant="muted">{totalSteps} 个步骤</Badge>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Film className="size-6 text-primary" />
            408 逐帧演示
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            把数据结构、组成原理、操作系统与网络里的过程拆成逐帧动画：可以播放、单步、拖动进度和切换倍速，
            看完再跳到对应知识点刷真题。演示按科目分组，点击任一张卡片进入播放器。
          </p>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Film className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">演示正在导入</p>
            <p className="text-xs text-muted-foreground">
              408 演示资产正在从来源站点逐帧镜像，导入完成后这里会自动出现目录。
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.subjectKey} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold">{group.label}</h2>
              <span className="text-xs text-muted-foreground">{group.demos.length} 个演示</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.demos.map((demo) => (
                <Link
                  key={demo.key}
                  href={`/learn/408/viz/${encodeURIComponent(demo.key)}`}
                  className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-5">{demo.title}</h3>
                    <PlayCircle className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  {demo.description ? (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{demo.description}</p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="muted">{demo.stepsCount} 步</Badge>
                    <Badge variant="muted">{demo.frameCount} 帧</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <Link href="/learn/408" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="size-3.5" /> 返回 408 知识体系
        </Link>
        <span>演示来源：408card.top（作者授权，仅个人学习使用，不再分发）</span>
      </div>
    </div>
  );
}

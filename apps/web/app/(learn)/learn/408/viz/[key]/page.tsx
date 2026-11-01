import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Film, ListOrdered, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DemoPlayer } from "@/components/exam/demo-player";
import { exam408DemoSubjectLabel, getExam408Demo } from "@/lib/exam-408-demos";
import { exam408PointHref } from "@/lib/exam-408-point-key";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」：演示播放页不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function decodeDemoKey(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function Exam408VizDemoPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const demo = await getExam408Demo(decodeDemoKey(key));
  if (!demo) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <Link href="/learn/408/viz" className="hover:text-foreground">演示目录</Link>
        <span>/</span>
        <span className="text-foreground">{demo.title}</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{exam408DemoSubjectLabel(demo.subjectKey)}</Badge>
            <Badge variant="muted">{demo.steps.length} 步</Badge>
            <Badge variant="muted">{demo.frameCount} 帧</Badge>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PlayCircle className="size-6 text-primary" />
            {demo.title}
          </h1>
          {demo.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{demo.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link href="/learn/408/viz" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <ArrowLeft className="size-3.5" /> 返回演示目录
            </Link>
            {demo.knowledgePointKey ? (
              <Link
                href={exam408PointHref(demo.knowledgePointKey)}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <BookOpen className="size-3.5" /> 关联知识点
              </Link>
            ) : null}
            {demo.sourceUrl ? <span className="text-muted-foreground">来源：{demo.sourceUrl}</span> : null}
          </div>
        </CardContent>
      </Card>

      <DemoPlayer steps={demo.steps} title={demo.title} />

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ListOrdered className="size-4 text-primary" />
            步骤说明
          </h2>
          <ol className="flex flex-col gap-2.5">
            {demo.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-6 text-foreground/90">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span>
                  {step.explain || "（本步无文字说明，可拖动进度条查看配图）"}
                  {step.frame ? null : (
                    <span className="ml-1 text-xs text-muted-foreground">· 纯文字步骤</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <Link href="/learn/408/viz" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Film className="size-3.5" /> 回到全部演示
        </Link>
        <span>演示来源：408card.top（作者授权，仅个人学习使用，不再分发）</span>
      </div>
    </div>
  );
}
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExamQuestionCard } from "@/components/exam/exam-question-card";
import { getExam408Point } from "@/lib/exam-408";
import { ArrowLeft, BookOpen, Layers3 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Exam408PointPage({
  params,
}: {
  params: Promise<{ key: string[] }>;
}) {
  const { key } = await params;
  const pointKey = key.join("/");
  const detail = await getExam408Point(pointKey);
  if (!detail) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">技术课程</Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">408 考研专项</Link>
        <span>/</span>
        <span>{detail.point.subject.title}</span>
        <span>/</span>
        <span className="text-foreground">{detail.point.title}</span>
      </nav>

      <Card rail="study">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{detail.point.subject.title}</Badge>
                <Badge variant="outline">{detail.point.chapter.title}</Badge>
                <Badge variant="muted">第 {detail.point.chapter.chapterNumber} 章 · 知识点</Badge>
              </div>
              <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <BookOpen className="size-6 text-primary" />
                {detail.point.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{detail.point.summary}</p>
            </div>
            <div className="rounded-xl bg-primary/10 px-5 py-3 text-center text-primary">
              <p className="text-2xl font-semibold tabular-nums">{detail.point.questionCount}</p>
              <p className="text-xs">关联真题</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.point.tags.map((tag) => (
              <Badge key={tag} variant="muted">{tag}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers3 className="size-4 text-primary" />
          <h2 className="text-lg font-semibold">关联真题</h2>
        </div>
        <Link
          href="/learn/408"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" /> 返回章节选择
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {detail.questions.map((question) => (
          <ExamQuestionCard key={question.key} question={question} />
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">来源</p>
          <p>{detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}

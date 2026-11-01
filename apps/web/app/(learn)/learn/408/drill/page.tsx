import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, LogIn } from "lucide-react";

import { CardDrill } from "@/components/exam/card-drill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CARD_SUBJECTS,
  isCardSubject,
  loadCardQueue,
  loadCardStats,
  type CardQueueScope,
} from "@/lib/exam-408-cards";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 408 刷卡页：首屏由服务端直接算好本组卡与统计（避免二次请求闪白），
 * 评级与"再来一组"走 /api/exam/408/cards。来源许可要求不再分发 → noindex。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SUBJECT_OPTIONS = CARD_SUBJECTS.map((subject) => ({ key: subject.key, title: subject.title }));

export default async function Exam408DrillPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const subjectParam = typeof params.subject === "string" ? params.subject : "";
  const subject = isCardSubject(subjectParam) ? subjectParam : null;
  const scope: CardQueueScope = params.scope === "mistake" ? "mistake" : "queue";
  const userId = await currentUserId();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/learn" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> 技术课程
        </Link>
        <span>/</span>
        <Link href="/learn/408" className="hover:text-foreground">
          408 考研专项
        </Link>
        <span>/</span>
        <span className="text-foreground">刷卡背诵</span>
      </nav>

      {userId ? (
        <DrillBody userId={userId} subject={subject} scope={scope} />
      ) : (
        <Card rail="study">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <BookOpenCheck className="size-5 text-primary" /> 408 刷卡背诵
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              刷卡进度按账号同步（复习卡的到期时间与连续天数都写在服务端），所以需要先登录。
            </p>
            <Button asChild>
              <Link href="/login">
                <LogIn className="size-4" /> 去登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function DrillBody({
  userId,
  subject,
  scope,
}: {
  userId: string;
  subject: string | null;
  scope: CardQueueScope;
}) {
  const [queue, stats] = await Promise.all([
    loadCardQueue(userId, { subject, scope, limit: 20 }),
    loadCardStats(userId, { subject }),
  ]);
  return (
    <CardDrill
      initialQueue={queue}
      initialStats={stats}
      subject={subject}
      scope={scope}
      subjectOptions={SUBJECT_OPTIONS}
    />
  );
}

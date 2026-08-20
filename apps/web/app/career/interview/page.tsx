"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function CareerInterviewPage() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
        </Button>
        <h1 className="page-title text-2xl font-bold tracking-tight">面试</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>面试题库与模拟面试（P3）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>阶段：P3 求职管理（当前 P0 仅完成职业画像入口，本页为占位）</p>
          <ul className="flex flex-col gap-1.5">
            <li>· interview_questions 题库刷题</li>
            <li>· 面试记录（答题 / 复盘）</li>
            <li>· 求职 Kanban 联动</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

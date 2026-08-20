"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function CareerResumePage() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
        </Button>
        <h1 className="page-title text-2xl font-bold tracking-tight">简历</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>简历资产整理与预览（P3 求职管理）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>阶段：P3 求职管理（当前 P0 仅完成职业画像入口，本页为占位）</p>
          <ul className="flex flex-col gap-1.5">
            <li>· 复用 resume_assets（技能 / 项目 / GitHub / 证书）</li>
            <li>· 简历预览与导出</li>
            <li>· 投递记录关联</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function CareerSkillsPage() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/career"><ChevronLeft className="size-4" /> 职业画像</Link>
        </Button>
        <h1 className="page-title text-2xl font-bold tracking-tight">技能树</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>技能标签体系 + 用户技能画像（P2 落地）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>阶段：P2 学习 × 招聘打通（当前 P0 仅完成职业画像入口，本页为占位）</p>
          <ul className="flex flex-col gap-1.5">
            <li>· skill_taxonomy 技能表 + 同义词归一化</li>
            <li>· user_skills 用户技能画像（resume_assets 回填 + 手动维护）</li>
            <li>· 岗位匹配度（规则版）+ 能力缺口分析</li>
            <li>· 缺口 → 一键加入学习路线</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

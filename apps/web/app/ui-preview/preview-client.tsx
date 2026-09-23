"use client";

/**
 * v13 UI 预览页（**仅本地核对用**）：一次性把本轮新增/改造的视觉件排在一页，
 * 方便改动后立刻用浏览器肉眼核对（生产构建会直接 404，不会上线）。
 */
import { useState } from "react";
import { Award, CheckCircle2, FileText, Gauge, PackageSearch, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FloatField, SearchInput } from "@/components/ui/input";
import { HoldButton } from "@/components/ui/hold-button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton, SkeletonCard, SkeletonList, SkeletonText } from "@/components/ui/skeleton";
import { ThemeSegmented, type ThemeValue } from "@/components/ui/theme-segmented";
import { TimerDial } from "@/components/ui/timer-dial";
import { UploadCard } from "@/components/ui/upload-card";
import { useToastStore } from "@/store/toast-store";

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="rounded-lg bg-muted/70 px-2.5 py-1.5 text-sm font-semibold">{title}</h2>
        {hint ? <p className="mt-1 px-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PreviewClient() {
  const push = useToastStore((s) => s.push);
  const toastCount = useToastStore((s) => s.toasts.length);
  const [theme, setTheme] = useState<ThemeValue>("light");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [progress, setProgress] = useState(46);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-10">
      <header>
        <h1 className="page-title text-2xl font-bold">v13 · UI 技法预览（仅开发环境）</h1>
        <p className="page-subtitle mt-1 text-sm">Uiverse 借鉴技法落地后的视觉件合集，用于改动后肉眼核对。</p>
      </header>

      <Block title="① 骨架屏 Skeleton" hint="斜切高光扫过 1.6s；深色档高光更弱">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="paper-card p-4">
            <Skeleton className="h-4 w-24" rounded="rounded-full" />
            <SkeletonText lines={3} className="mt-3" />
            <Skeleton className="mt-3 h-9 w-28" rounded="rounded-full" />
          </div>
          <SkeletonCard lines={3} withAction />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-10" rounded="rounded-full" />
            <Skeleton className="h-3.5 w-2/3" rounded="rounded-full" />
            <Skeleton className="h-3 w-1/3" rounded="rounded-full" />
          </div>
        </div>
        <SkeletonList rows={2} />
      </Block>

      <Block title="② 进度环 / 计时表盘" hint="conic-gradient + mask；表盘为秒表刻度 + 指针">
        <div className="flex flex-wrap items-center gap-6">
          <ProgressRing value={72} size={112} thickness={10} from="#2f74c0" to="#5b93d6" label="整体进度 72%">
            <span className="text-2xl font-bold tabular-nums">72%</span>
            <span className="text-[11px] text-muted-foreground">整体进度</span>
          </ProgressRing>
          <ProgressRing value={34} size={92} thickness={9} from="#e1781c" to="#f1a45c" label="运动 34%">
            <span className="text-lg font-bold tabular-nums">34%</span>
          </ProgressRing>
          <ProgressRing value={progress} size={92} thickness={9} label="可调">
            <span className="text-lg font-bold tabular-nums">{progress}%</span>
          </ProgressRing>
          <div className="flex flex-col gap-2">
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-40" />
            <span className="text-xs text-muted-foreground">拖动看环的过渡</span>
          </div>
          <ProgressRing value={0} size={64} thickness={8} spinning label="加载中" />
        </div>
        <div className="rounded-2xl bg-[#141019] p-6">
          <TimerDial ratio={0.42} running tone="focus" size={300} />
        </div>
      </Block>

      <Block title="③ 按钮三态与长按确认" hint="按下 0.97；loading 内嵌 spinner；危险操作按住 0.9s">
        <div className="flex flex-wrap items-center gap-3">
          <Button>主要按钮</Button>
          <Button variant="secondary">次级</Button>
          <Button variant="outline">描边</Button>
          <Button variant="danger">危险</Button>
          <Button loading>提交中</Button>
          <HoldButton onConfirm={() => {}} icon={<Trash2 className="size-4" />}>
            按住删除
          </HoldButton>
        </div>
      </Block>

      <Block title="④ 表单：浮动标签 / 胶囊搜索" hint="聚焦时描边 6s 转一圈，只出现在聚焦态">
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatField label="证书名称 *" value={name} onChange={setName} />
          <FloatField label="有效期至" value="" onChange={() => {}} type="date" />
          <SearchInput value={q} onChange={setQ} placeholder="搜型号或品牌，如 ASTROX / 天斧" />
          <SearchInput value="" onChange={() => {}} placeholder="招花：搜索职位、公司、标签" />
        </div>
      </Block>

      <Block title="⑤ 上传卡" hint="拖拽 / 点击选择 / 进度 / 移除">
        <div className="grid gap-4 sm:grid-cols-2">
          <UploadCard title="上传简历（PDF / Word）" busy={false} onPick={() => {}} accept=".pdf" />
          <UploadCard title="上传简历" fileName="张同学-简历.pdf" progress={62} onPick={() => {}} onRemove={() => {}} />
          <UploadCard title="上传证书照片" error="文件超过 5MB，请压缩后重试" onPick={() => {}} />
        </div>
      </Block>

      <Block title="⑥ 主题分段控件" hint="滑块过冲缓动 + 图标形变">
        <div className="flex items-center gap-4">
          <ThemeSegmented value={theme} onChange={setTheme} />
          <span className="text-xs text-muted-foreground">当前：{theme}</span>
        </div>
      </Block>

      <Block title="⑦ 提示条 Toast" hint="图标徽章 + 副标题 + 底部剩余时间细条（悬停暂停）">
        <p className="text-xs text-muted-foreground">store 里的提示条数量：{toastCount}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => push("原生按钮：测试 store", "info")}
            className="rounded-xl border border-border px-4 py-2 text-sm"
          >
            原生 button 触发
          </button>
          <Button variant="secondary" onClick={() => push("简历已上传", "success", "随时可在手机 App 里预览")}>
            成功提示
          </Button>
          <Button variant="secondary" onClick={() => push("上传失败：文件超过 5MB", "error")}>
            错误提示
          </Button>
          <Button variant="secondary" onClick={() => push("正在同步 3 条改动", "info", "完成后会自动刷新")}>
            信息提示
          </Button>
        </div>
      </Block>

      <Block title="⑧ 空状态与底纹" hint="低透明度几何拼花 / 灰阶人字纹">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="paper-card">
            <EmptyState icon={PackageSearch} title="这一类暂时没有图库素材" hint="换个类别或关键词，也可以自己上传照片" pattern="bauhaus" action={<Button size="sm">去上传</Button>} />
          </div>
          <div className="paper-card">
            <EmptyState icon={Award} title="还没有证书" hint="添加你的第一张证书，例如 CISP、HCIP" pattern="chevron" action={<Button size="sm">添加证书</Button>} />
          </div>
        </div>
      </Block>

      <Block title="⑨ 卡片质感（悬停抬升 + 胶囊）" hint="装备图鉴卡 / 奖杯成就卡（Web 端复用同一套 class）">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="lift paper-card flex flex-col gap-2 p-3">
            <div className="grid aspect-square place-items-center rounded-xl bg-white text-muted-foreground">
              <FileText className="size-8" />
            </div>
            <span className="text-sm font-semibold">ASTROX 100 ZZ</span>
            <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">YONEX</span>
          </div>
          <div className="lift paper-card relative overflow-hidden p-5">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-warning to-primary" />
            <span aria-hidden className="pattern-bauhaus pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
            <div className="relative flex flex-col gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent-strong ring-1 ring-accent/30">
                <Trophy className="size-5" />
              </span>
              <p className="text-sm font-semibold">CISP 注册信息安全工程师</p>
              <p className="text-xs text-muted-foreground">取得：2026-03-14</p>
            </div>
          </div>
          <div className="lift paper-card flex flex-col gap-2 p-4">
            <span className="icon-chip h-9 w-9 bg-success/15 text-success-strong">
              <CheckCircle2 className="size-4" />
            </span>
            <p className="text-sm font-medium">今日任务 5/7 完成</p>
            <svg viewBox="0 0 24 24" className="check-draw size-5 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 12.4l2.7 2.7L16.4 9.4" />
            </svg>
            <span className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground">
              <Gauge className="size-3.5" /> 勾选描边动画
            </span>
          </div>
        </div>
      </Block>
    </div>
  );
}
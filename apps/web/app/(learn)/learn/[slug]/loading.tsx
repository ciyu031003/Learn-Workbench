/**
 * /learn/[slug] 的加载骨架（Next 16 loading.tsx）。
 *
 * 课程详情要读阶段/知识点/讲义/题目，是三个学习页里最重的一个；先渲染大纲骨架，
 * 让"点课程 → 立刻看到结构 → 内容填进来"的顺序稳定。
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function CourseDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-5 sm:p-7">
      <Bar className="h-5 w-28" />
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-5">
        <Bar className="h-8 w-56" />
        <Bar className="h-4 w-80" />
        <div className="flex flex-wrap gap-2">
          <Bar className="h-6 w-20 rounded-full" />
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-16 rounded-full" />
        </div>
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
          <Bar className="h-6 w-2/5" />
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * /learn/questions 的加载骨架（Next 16 loading.tsx）。
 *
 * 题库一次性下发 2400+ 条记录，服务端查库 + 序列化需要时间；骨架把筛选区与列表高度先占住，
 * 避免"点进来一片空白再突然铺满"的跳变。
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function QuestionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-3">
        <Bar className="h-5 w-28" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Bar className="h-7 w-32" />
            <Bar className="h-4 w-80" />
          </div>
          <Bar className="h-9 w-72" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-wrap items-center gap-1.5">
            <Bar className="h-4 w-10" />
            {Array.from({ length: 6 }, (_, chip) => (
              <Bar key={chip} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        ))}
      </div>
      <Bar className="h-4 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Bar className="h-5 w-24 rounded-full" />
              <Bar className="h-5 w-12 rounded-full" />
              <Bar className="h-4 w-16" />
            </div>
            <Bar className="h-5 w-3/4" />
            <Bar className="h-8 w-full" />
            <Bar className="h-8 w-full" />
            <Bar className="h-9 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

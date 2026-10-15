/**
 * /learn 的加载骨架（Next 16 loading.tsx）。
 *
 * 服务端查库（force-dynamic）期间先渲染骨架：既给即时反馈，也把首屏高度占住，
 * 避免数据到达后整页跳动（CLS）。
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function LearnLibraryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bar className="h-7 w-40" />
          <Bar className="h-4 w-72" />
        </div>
        <Bar className="h-9 w-72" />
      </div>
      <Bar className="h-20 w-full rounded-xl" />
      <div className="flex items-center gap-3">
        <Bar className="h-9 w-36" />
        <Bar className="h-9 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-5">
            <Bar className="h-5 w-32" />
            <Bar className="h-4 w-24" />
            <Bar className="h-12 w-full" />
            <Bar className="h-10 w-full" />
            <Bar className="h-9 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

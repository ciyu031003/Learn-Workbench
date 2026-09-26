"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_MAX_BYTES, humanSize } from "@/lib/ui-kit";

/**
 * v13 U7：上传卡（技法参考 uiverse.io/Jerome-W-90/shy-jellyfish-2, MIT）。
 * 支持点击选择 + 拖拽投放 + 上传进度 + 失败重试 + 移除。
 */
export function UploadCard({
  title,
  hint,
  accept,
  onPick,
  progress,
  busy,
  fileName,
  error,
  onRemove,
  className,
}: {
  title: string;
  hint?: string;
  accept?: string;
  onPick: (file: File) => void;
  /** 0–100，传入即显示进度条 */
  progress?: number;
  busy?: boolean;
  fileName?: string;
  error?: string | null;
  onRemove?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(file: File | undefined | null) {
    if (!file) return;
    onPick(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-dashed px-4 py-4 transition-all duration-200",
        over
          ? "scale-[1.01] border-primary/70 bg-primary/5 shadow-[var(--elev-2)]"
          : "border-border bg-surface/70 hover:border-primary/40 hover:shadow-[var(--elev-1)]",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex items-start gap-3">
        <span className="icon-chip icon-chip-glow h-10 w-10 shrink-0 bg-primary/10 text-primary-strong">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{fileName || title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {error ? <span className="text-danger-strong">{error}</span> : (hint ?? `支持拖拽，单个不超过 ${humanSize(UPLOAD_MAX_BYTES)}`)}
          </p>
          {typeof progress === "number" ? (
            <div className="progress-track mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
              <div className="progress-fill progress-glow h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="press rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary-strong disabled:opacity-50"
            >
              {fileName ? "重新选择" : "选择文件"}
            </button>
            {fileName && onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="press rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-danger-strong"
              >
                移除
              </button>
            ) : null}
          </div>
        </div>
        {fileName && onRemove ? (
          <button type="button" onClick={onRemove} aria-label="移除文件" className="press-soft text-muted-foreground transition-colors hover:text-foreground">
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { FileText, Trash2, ExternalLink } from "lucide-react";
import { UploadCard } from "@/components/ui/upload-card";
import { HoldButton } from "@/components/ui/hold-button";
import { useToastStore } from "@/store/toast-store";

/** 简历文件（v12 P2-2）：PDF / Word ≤5MB，文件本体在 COS 桶的 resume/ 私有目录 */
interface ResumeFileRow {
  id: number;
  fileName: string;
  mime: string;
  bytes: number;
  createdAt: string;
}

function sizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function ResumeFilesCard() {
  const pushToast = useToastStore((s) => s.push);
  const [files, setFiles] = useState<ResumeFileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/resume-files");
      if (!r.ok) return;
      const d = await r.json();
      setFiles(Array.isArray(d.files) ? d.files : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const r = await fetch("/api/resume-files", { method: "POST", body: form });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(typeof d?.error === "string" ? d.error : "上传失败");
      pushToast("简历已上传");
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "上传失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: ResumeFileRow) => {
    const r = await fetch("/api/resume-files/" + row.id, { method: "DELETE" });
    if (!r.ok) {
      pushToast("删除失败", "error");
      return;
    }
    await load();
  };

  return (
    <Card className="print:hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
        <FileText className="size-4 text-primary" />
        <span className="text-sm font-semibold">简历文件</span>
        <span className="text-xs text-muted-foreground">PDF / Word · ≤5MB · 存私有目录，仅自己可见</span>
      </div>

      {/* v13 U7：上传卡（技法参考 uiverse.io/Jerome-W-90/shy-jellyfish-2, MIT） */}
      <div className="px-4 pb-3">
        <UploadCard
          title="上传简历（PDF / Word）"
          hint="拖拽到框里或点「选择文件」，单个不超过 5MB"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          busy={busy}
          onPick={(file) => void upload(file)}
        />
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4">
        {loading ? (
          <span className="text-xs text-muted-foreground">加载中…</span>
        ) : files.length === 0 ? (
          <span className="text-xs text-muted-foreground">还没有上传简历；上传后可以在手机 App 里直接预览。</span>
        ) : (
          files.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.fileName}</p>
                <p className="text-xs text-muted-foreground">{sizeText(row.bytes)} · {String(row.createdAt).slice(0, 10)}</p>
              </div>
              <a
                href={"/api/resume-files/" + row.id}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60"
                aria-label="预览"
              >
                <ExternalLink className="size-4" />
              </a>
              <HoldButton
                onConfirm={() => void remove(row)}
                icon={<Trash2 className="size-4" />}
                className="border-transparent bg-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-danger"
              >
                按住删除
              </HoldButton>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

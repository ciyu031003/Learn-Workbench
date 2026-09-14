"use client";

import type { ReactNode } from "react";
import {
  getResumeTemplate,
  type ResumeContent,
  type ResumeSectionConfig,
  type ResumeStyle,
} from "@learn-workbench/shared";

const SPACING: Record<ResumeStyle["spacing"], { gap: string; block: string; line: number }> = {
  compact: { gap: "10px", block: "12px", line: 1.45 },
  normal: { gap: "14px", block: "18px", line: 1.55 },
  relaxed: { gap: "18px", block: "24px", line: 1.7 },
};

const PAGE: Record<ResumeStyle["page"], { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },      // 96dpi A4
  Letter: { w: 816, h: 1056 },  // 96dpi Letter
};

const SECTION_TITLE: Record<Exclude<ResumeSectionConfig["key"], "basics">, string> = {
  education: "教育经历",
  skills: "技能",
  experience: "工作经历",
  projects: "项目经历",
  certificates: "证书与认证",
};

export interface ResumePreviewProps {
  title: string;
  templateKey: string;
  content: ResumeContent;
  sectionOrder: ResumeSectionConfig[];
  /** 已合并模板默认值的样式 */
  styles: ResumeStyle;
  /** 预览缩放（打印时固定为 1） */
  scale?: number;
}

/**
 * A4 简历渲染：**刻意不使用玻璃质感**（方案 §26）——专业、克制、可打印。
 * 白底深灰字 + 单一强调色；支持 single / sidebar / timeline 三种版式。
 */
export function ResumePreview({
  title,
  templateKey,
  content,
  sectionOrder,
  styles,
  scale = 1,
}: ResumePreviewProps) {
  const tpl = getResumeTemplate(templateKey);
  const sp = SPACING[styles.spacing];
  const page = PAGE[styles.page];
  const accent = styles.accent;
  const fontFamily =
    styles.fontFamily === "serif"
      ? 'Georgia, "Songti SC", "SimSun", serif'
      : '-apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';
  const base = 13 * styles.fontScale;

  const visible = sectionOrder.filter((s) => s.visible);

  const Heading = ({ text }: { text: string }) => {
    const label = (
      <span style={{ fontSize: base + 1.5, fontWeight: 700, color: "#111827", letterSpacing: "0.02em" }}>
        {text}
      </span>
    );
    if (tpl.heading === "bar") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 3, height: base + 4, background: accent, borderRadius: 2 }} />
          {label}
        </div>
      );
    }
    if (tpl.heading === "underline") {
      return (
        <div style={{ borderBottom: `1.5px solid ${accent}`, paddingBottom: 3, marginBottom: 8 }}>
          {label}
        </div>
      );
    }
    return <div style={{ marginBottom: 8 }}>{label}</div>;
  };

  const timeline = tpl.layout === "timeline";

  const body = (key: ResumeSectionConfig["key"]) => {
    switch (key) {
      case "basics":
        return (
          <div>
            <div style={{ fontSize: base + 12, fontWeight: 800, color: "#0f172a" }}>
              {content.basics.name || "（未填写姓名）"}
            </div>
            <div style={{ marginTop: 3, fontSize: base, color: "#374151" }}>
              {[content.basics.headline || content.basics.targetRole, content.basics.city, content.basics.email]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
            {content.basics.summary ? (
              <div style={{ marginTop: 8, fontSize: base, color: "#374151", lineHeight: sp.line }}>
                {content.basics.summary}
              </div>
            ) : null}
          </div>
        );
      case "education":
        if (content.education.length === 0) return <Empty />;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: sp.gap }}>
            {content.education.map((e, i) => (
              <div
                key={i}
                style={
                  timeline
                    ? { borderLeft: `2px solid ${accent}44`, paddingLeft: 10, display: "flex", justifyContent: "space-between", gap: 12 }
                    : { display: "flex", justifyContent: "space-between", gap: 12 }
                }
              >
                <div>
                  <div style={{ fontSize: base, fontWeight: 600, color: "#111827" }}>
                    {e.school}
                    {e.major ? <span style={{ fontWeight: 400, color: "#374151" }}> · {e.major}</span> : null}
                    {e.degree ? <span style={{ fontWeight: 400, color: "#374151" }}> · {e.degree}</span> : null}
                  </div>
                  {e.note ? <div style={{ fontSize: base - 1, color: "#4b5563", marginTop: 2 }}>{e.note}</div> : null}
                </div>
                <div style={{ fontSize: base - 1, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {[e.start, e.end].filter(Boolean).join(" – ")}
                </div>
              </div>
            ))}
          </div>
        );
      case "skills":
        if (content.skills.length === 0) return <Empty />;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {content.skills.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: base - 1,
                  padding: "3px 9px",
                  borderRadius: 999,
                  border: `1px solid ${accent}55`,
                  background: `${accent}12`,
                  color: "#1f2937",
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        );
      case "experience":
        if (content.experience.length === 0) return <Empty />;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: sp.block }}>
            {content.experience.map((x, i) => (
              <div key={i} style={timeline ? { borderLeft: `2px solid ${accent}44`, paddingLeft: 10 } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: base, fontWeight: 600, color: "#111827" }}>
                    {x.title}
                    {x.org ? <span style={{ fontWeight: 400, color: "#374151" }}> · {x.org}</span> : null}
                  </span>
                  <span style={{ fontSize: base - 1, color: "#6b7280", whiteSpace: "nowrap" }}>
                    {[x.start, x.end].filter(Boolean).join(" – ")}
                  </span>
                </div>
                {x.description ? (
                  <div style={{ fontSize: base - 0.5, color: "#374151", marginTop: 3, lineHeight: sp.line, whiteSpace: "pre-wrap" }}>
                    {x.description}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        );
      case "projects":
        if (content.projects.length === 0) return <Empty />;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: sp.block }}>
            {content.projects.map((p, i) => (
              <div key={i} style={timeline ? { borderLeft: `2px solid ${accent}44`, paddingLeft: 10 } : undefined}>
                <div style={{ fontSize: base, fontWeight: 600, color: "#111827" }}>
                  {p.title}
                  {p.kind === "github" ? <span style={{ fontWeight: 400, color: "#6b7280" }}>（GitHub）</span> : null}
                </div>
                {p.content ? (
                  <div style={{ fontSize: base - 0.5, color: "#374151", marginTop: 2, lineHeight: sp.line }}>{p.content}</div>
                ) : null}
                {p.url ? (
                  <div style={{ fontSize: base - 2, color: accent, marginTop: 1, wordBreak: "break-all" }}>{p.url}</div>
                ) : null}
              </div>
            ))}
          </div>
        );
      case "certificates":
        if (content.certificates.length === 0) return <Empty />;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: sp.gap }}>
            {content.certificates.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: base - 0.5, color: "#111827" }}>
                  {c.name}
                  {c.issuer ? <span style={{ color: "#6b7280" }}> · {c.issuer}</span> : null}
                </span>
                <span style={{ fontSize: base - 1.5, color: "#6b7280", whiteSpace: "nowrap" }}>{c.earnedDate ?? ""}</span>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const section = (key: ResumeSectionConfig["key"]) => (
    <section key={key} data-resume-section={key}>
      {key === "basics" ? (
        body("basics")
      ) : (
        <>
          <Heading text={SECTION_TITLE[key]} />
          {body(key)}
        </>
      )}
    </section>
  );

  // 侧栏版式：basics + 技能/证书 收进左栏，其余进右栏
  const sidebarKeys: ResumeSectionConfig["key"][] = ["skills", "certificates"];
  let mainSections: ReactNode;
  if (tpl.layout === "sidebar") {
    const left = visible.filter((s) => sidebarKeys.includes(s.key));
    const right = visible.filter((s) => !sidebarKeys.includes(s.key));
    mainSections = (
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        <div style={{ width: "31%", display: "flex", flexDirection: "column", gap: sp.block }}>
          {left.map((s) => section(s.key))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: sp.block, minWidth: 0 }}>
          {right.map((s) => section(s.key))}
        </div>
      </div>
    );
  } else {
    mainSections = (
      <div style={{ display: "flex", flexDirection: "column", gap: sp.block }}>{visible.map((s) => section(s.key))}</div>
    );
  }

  return (
    <div
      id="resume-print-root"
      data-resume-page
      data-template={tpl.key}
      style={{
        width: page.w,
        minHeight: page.h,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        background: "#ffffff",
        color: "#111827",
        fontFamily,
        padding: "48px 52px",
        boxSizing: "border-box",
        boxShadow: "0 10px 40px rgba(15,23,42,0.18)",
        borderRadius: 2,
      }}
    >
      {/* 文档标题：仅用于导出文件名与无障碍，不参与版面 */}
      <div style={{ display: "none" }}>{title}</div>
      {mainSections}
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>暂无内容</div>;
}
import type { LucideIcon } from "lucide-react";
import {
  Cpu,
  Layout,
  Coffee,
  ChartLine,
  Brain,
  Shield,
  Compass,
  Languages,
  Activity,
  Volleyball,
} from "lucide-react";
import type { DomainIdentity } from "@/store/domain-store";

/** 领域图标映射：与 db/migrations/024 及 packages/content 模板的 icon 字符串保持一致 */
export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  layout: Layout,
  coffee: Coffee,
  "chart-line": ChartLine,
  brain: Brain,
  shield: Shield,
  compass: Compass,
  languages: Languages,
  activity: Activity,
  dribbble: Volleyball,
};

export function DomainIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = (icon && DOMAIN_ICONS[icon]) || Compass;
  return <Icon className={className} />;
}

/** 领域行 → 全局领域身份（供 app-shell / dashboard / roadmap 联动展示） */
export function toDomainIdentity(row: {
  career_key: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  kind_label?: string | null;
  is_locked?: boolean | null;
}): DomainIdentity {
  return {
    careerKey: row.career_key,
    name: row.name,
    color: row.color ?? "#6366f1",
    icon: row.icon ?? "compass",
    kindLabel: row.kind_label ?? "",
    isLocked: !!row.is_locked,
  };
}

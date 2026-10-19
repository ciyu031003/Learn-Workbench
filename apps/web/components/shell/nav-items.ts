import type { ShellIcon } from "./icons";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Dumbbell,
  FileText,
  Flower,
  FolderCog,
  FolderGit2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Map,
  MessageSquare,
  NotebookPen,
  Radar,
  Repeat,
  Rocket,
  Salad,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "./icons";

/**
 * AppShell 的导航数据与纯判断。
 *
 * S6-6（IA 重排，2026-10-19）：
 *  - 学习下拉改成**三组**（学习 / 健康 / 更多），每组 ≤4 项、组内按使用频率排序；
 *  - 「专注」从学习下拉里独立成一级入口（/tasks?focus=1，真参数、能直接打开计时器）；
 *  - 深层页（/settings/content、/wellbeing/*、/career/*）都在 ≤2 次点击内可达；
 *  - 下载地址不再写死：由 NEXT_PUBLIC_DOWNLOAD_URL 提供，未配置时导航隐藏入口。
 *
 * 只放"数据 + 纯函数"：链接、文案、图标、hash/query、选中态判定。
 * 视觉/DOM 由 `components/shell/*` 组件负责，这里是可单测的纯层。
 */
export interface ShellNavItem {
  href: string;
  label: string;
  icon: ShellIcon;
  /** 锚点（如 /tasks#focus），拼接在 href 之后 */
  hash?: string;
  /** 查询串（如 focus=1），拼接成 /tasks?focus=1 */
  query?: string;
}

/** 一级入口：首页 / 我的一天 / 专注（专注独立，不再藏在学习下拉里） */
export const NAV: readonly ShellNavItem[] = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/today", label: "我的一天", icon: Sparkles },
  { href: "/tasks", label: "专注", icon: Timer, query: "focus=1" },
];

/** 学习下拉：三组，每组 ≤4 项（S6-6 IA） */
export interface ShellNavGroup {
  title: string;
  items: readonly ShellNavItem[];
}

export const LEARN_GROUPS: readonly ShellNavGroup[] = [
  {
    title: "学习",
    items: [
      { href: "/learn", label: "技术课程", icon: BookOpen },
      { href: "/roadmap", label: "路线图", icon: Map },
      { href: "/tasks", label: "今日任务", icon: ListTodo },
      { href: "/logs", label: "学习日志", icon: NotebookPen },
    ],
  },
  {
    title: "健康",
    items: [
      { href: "/wellbeing", label: "健康总览", icon: Activity },
      { href: "/wellbeing/workout", label: "训练记录", icon: Dumbbell },
      { href: "/wellbeing/nutrition", label: "今日饮食", icon: Salad },
      { href: "/wellbeing/sports", label: "运动档案", icon: Trophy },
    ],
  },
  {
    title: "更多",
    items: [
      { href: "/habits", label: "习惯打卡", icon: Repeat },
      { href: "/trackers", label: "领域记录", icon: Gauge },
      { href: "/settings/content", label: "内容管理", icon: FolderCog },
    ],
  },
];

/** 兼容旧导出（扁平列表 = 三组顺序拼接；测试/旧引用仍可用） */
export const LEARN_ITEMS: readonly ShellNavItem[] = LEARN_GROUPS.flatMap((g) => g.items);

/** 招花（一级入口，桌面顶栏以独立链接渲染） */
export const JOBS_ITEM: ShellNavItem = { href: "/jobs", label: "招花", icon: Flower };

/** 设置（一级入口；/settings/content 等深层页由「学习 → 更多」组覆盖） */
export const SETTINGS_ITEM: ShellNavItem = { href: "/settings", label: "设置", icon: Settings };

/** 职业分组（画像 / 技能树 / 简历 / GitHub / 面试 / 求职 / 市场） */
export const CAREER_ITEMS: readonly ShellNavItem[] = [
  { href: "/career", label: "职业画像", icon: Users },
  { href: "/career/profile", label: "我的资料", icon: UserRound },
  { href: "/career/skills", label: "技能树", icon: GraduationCap },
  { href: "/career/radar", label: "就业雷达", icon: Radar },
  { href: "/career/certificates", label: "我的证书", icon: Award },
  { href: "/career/resume", label: "简历", icon: FileText },
  { href: "/career/resume-assets", label: "简历资产", icon: FolderGit2 },
  { href: "/career/interview", label: "面试", icon: MessageSquare },
  { href: "/career/applications", label: "我的求职", icon: Briefcase },
  { href: "/career/market", label: "市场分析", icon: BarChart3 },
];

/** 移动端底部导航（5 入口：首页 / 学习 / 招花 / 职业 / 我的） */
export const BOTTOM_TABS: readonly ShellNavItem[] = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/roadmap", label: "学习", icon: GraduationCap },
  { href: "/jobs", label: "招花", icon: Flower },
  { href: "/career", label: "职业", icon: Rocket },
  { href: "/settings", label: "我的", icon: Settings },
];

/** 导航项最终的链接（href + ?query + #hash），组件与测试共用 */
export function navHref(item: ShellNavItem): string {
  const query = item.query ? `?${item.query}` : "";
  return item.href + query + (item.hash ?? "");
}

/** 下载地址：只接受 http(s) 绝对地址；空/非法 → null（导航隐藏下载入口） */
export function resolveDownloadUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** 顶栏选中态 key（滑动胶囊指示器用）。 */
export type NavActiveKey = "dashboard" | "today" | "learn" | "jobs" | "career" | "settings";

/**
 * 路径 -> 顶栏选中态 key（纯函数）。
 *
 * 学习段覆盖：/roadmap、/tasks、/logs、/wellbeing、/habits、/trackers（都在学习下拉/健康组里）。
 * 未命中的路径返回 null（不显示胶囊）。
 */
export function getNavActiveKey(pathname: string): NavActiveKey | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/today") return "today";
  if (
    pathname.startsWith("/roadmap") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/logs") ||
    pathname.startsWith("/wellbeing") ||
    pathname.startsWith("/habits") ||
    pathname.startsWith("/trackers")
  ) {
    return "learn";
  }
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/career")) return "career";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

/** 导航项是否选中：自身或子路径（`/jobs` 命中 `/jobs/1`，但不命中 `/jobsx`）。 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

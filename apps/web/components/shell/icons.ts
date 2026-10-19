/**
 * AppShell 拆分用图标表：集中从 lucide-react 引入，避免每个 shell 组件各自 import 造成重复/漂移。
 * 拆自 `components/app-shell.tsx`（原 27 个 lucide 图标）。
 */
export {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronDown,
  Download,
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
} from "lucide-react";

/** 任意 lucide 图标的类型（nav 常量里 icon 字段的类型）。 */
export type ShellIcon = typeof import("lucide-react").LayoutDashboard;

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Brain,
  Crosshair,
  GitBranch,
  GraduationCap,
  HeartPulse,
  Layers,
  LineChart,
  Milestone,
  NotebookPen,
  Scale,
  Settings,
  ShieldAlert,
  Target,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";

export interface BdoNavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const BDO_NAV: readonly BdoNavItem[] = [
  { href: "/bdo", label: "Command Center", short: "HQ", icon: Crosshair },
  {
    href: "/bdo/charter",
    label: "£1M MRR Charter (Partner Prompt)",
    short: "MRR",
    icon: ScrollText,
  },
  { href: "/bdo/roadmap", label: "Billion Dollar Roadmap", short: "Tree", icon: GitBranch },
  { href: "/bdo/dentago", label: "Dentago Metrics", short: "Biz", icon: LineChart },
  { href: "/bdo/compounding", label: "Compounding Engine", short: "+", icon: TrendingUp },
  { href: "/bdo/goals", label: "Strategic Goals", short: "Goals", icon: Target },
  { href: "/bdo/acquisition", label: "Acquisition Playbook", short: "Exit", icon: Layers },
  { href: "/bdo/timeline", label: "Life Timeline", short: "Life", icon: Milestone },
  { href: "/bdo/anti-delusion", label: "Anti-Delusion Metrics", short: "Truth", icon: ShieldAlert },
  { href: "/bdo/journal", label: "Founder Journal", short: "Log", icon: NotebookPen },
  { href: "/bdo/archive", label: "Archive", short: "Arc", icon: Archive },
  { href: "/bdo/decisions", label: "Decision Log", short: "Court", icon: Scale },
  { href: "/bdo/health", label: "Health & Energy", short: "Body", icon: HeartPulse },
  { href: "/bdo/relationships", label: "Relationships & Network", short: "Net", icon: Users },
  { href: "/bdo/deep-work", label: "Deep Work Tracker", short: "Flow", icon: Brain },
  { href: "/bdo/learning", label: "Learning System", short: "Mind", icon: GraduationCap },
  { href: "/bdo/settings", label: "Settings", short: "Cfg", icon: Settings },
] as const;

export function normalizeBdoPath(pathname: string): string {
  if (pathname === "/bdo" || pathname === "/bdo/") return "/bdo";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

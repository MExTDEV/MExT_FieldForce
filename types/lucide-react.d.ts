declare module "lucide-react" {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

  export type LucideIcon = ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
  >;

  export const ArrowDownRight: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const BarChart3: LucideIcon;
  export const BookOpenCheck: LucideIcon;
  export const CalendarCheck: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const CircleHelp: LucideIcon;
  export const ClipboardCheck: LucideIcon;
  export const Clock3: LucideIcon;
  export const Contact: LucideIcon;
  export const FileDown: LucideIcon;
  export const Filter: LucideIcon;
  export const Gauge: LucideIcon;
  export const GraduationCap: LucideIcon;
  export const Info: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Mail: LucideIcon;
  export const ListChecks: LucideIcon;
  export const LoaderCircle: LucideIcon;
  export const MapPin: LucideIcon;
  export const Menu: LucideIcon;
  export const MessageSquareText: LucideIcon;
  export const Minus: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const PanelLeftClose: LucideIcon;
  export const Phone: LucideIcon;
  export const Play: LucideIcon;
  export const Plus: LucideIcon;
  export const Save: LucideIcon;
  export const Send: LucideIcon;
  export const Search: LucideIcon;
  export const Settings: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Target: LucideIcon;
  export const Trash2: LucideIcon;
  export const UserCog: LucideIcon;
  export const UserRound: LucideIcon;
  export const Users: LucideIcon;
  export const UsersRound: LucideIcon;
  export const X: LucideIcon;
}

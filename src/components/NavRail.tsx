"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  Building2,
  Boxes,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { icon: LucideIcon; label: string; active?: boolean };

const PRIMARY: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ClipboardList, label: "Requests" },
  { icon: MapIcon, label: "Operations Map" },
  { icon: Boxes, label: "Readiness" },
  { icon: Building2, label: "Partners" },
];

const SECONDARY: NavItem[] = [
  { icon: LifeBuoy, label: "Help" },
  { icon: Settings, label: "Settings" },
];

function RailButton({ icon: Icon, label, active }: NavItem) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
        active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      )}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}

export default function NavRail() {
  return (
    <aside className="hidden sm:flex w-16 shrink-0 flex-col items-center gap-1 bg-slate-900 py-3">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
        C
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {PRIMARY.map((item) => (
          <RailButton key={item.label} {...item} />
        ))}
      </nav>

      <div className="flex flex-col items-center gap-1">
        {SECONDARY.map((item) => (
          <RailButton key={item.label} {...item} />
        ))}
      </div>
    </aside>
  );
}

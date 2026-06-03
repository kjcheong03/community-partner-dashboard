"use client";

import { LayoutDashboard, ClipboardList, MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ClipboardList, label: "Requests", active: false },
  { icon: MapPin, label: "Areas", active: false },
  { icon: Building2, label: "Organisations", active: false },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-slate-800 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
            C
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">CARA</p>
            <p className="text-slate-400 text-xs leading-tight">Community Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">CARA v1.0 · Prototype</p>
      </div>
    </aside>
  );
}

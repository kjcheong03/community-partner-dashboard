"use client";

import { Download } from "lucide-react";

export default function TopNav() {
  return (
    <header className="bg-slate-900 px-6 flex items-center justify-between h-14 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
          C
        </div>
        <span className="text-white font-semibold text-sm">CARA</span>
        <span className="text-slate-500 text-sm">|</span>
        <span className="text-slate-300 text-sm">Community Dashboard</span>
        <span className="text-slate-600 text-xs ml-2 hidden lg:block">
          SG Cares Volunteer Centre · East Region
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-xs hidden lg:block">
          {new Date().toLocaleString("en-SG", {
            day: "2-digit", month: "short",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })}
        </span>
        <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Download size={12} />
          Export
        </button>
      </div>
    </header>
  );
}

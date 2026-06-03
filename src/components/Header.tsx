"use client";

import { Download, RefreshCw } from "lucide-react";

export default function Header() {
  const now = new Date().toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Community Needs Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          SG Cares Volunteer Centre · East Region
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
          <RefreshCw size={12} />
          <span>Last updated {now}</span>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Download size={14} />
          Export Summary
        </button>
      </div>
    </header>
  );
}

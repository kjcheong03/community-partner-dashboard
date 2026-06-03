"use client";

import { Download } from "lucide-react";
import type { Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

const topics: { label: Topic; emoji: string }[] = [
  { label: "COVID-19", emoji: "🦠" },
  { label: "Dengue", emoji: "🦟" },
  { label: "Haze", emoji: "🌫️" },
];

type Props = {
  selected: Topic;
  onChange: (t: Topic) => void;
};

export default function TopNav({ selected, onChange }: Props) {
  return (
    <header className="bg-slate-900 px-6 py-0 flex items-center justify-between h-14 shrink-0">
      {/* Brand */}
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

      {/* Topic switcher — pill tabs */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-full p-1">
        {topics.map(({ label, emoji }) => (
          <button
            key={label}
            onClick={() => onChange(label)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              selected === label
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Actions */}
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

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { HelpRequest, Topic } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
};

export default function CommunityInsights({ requests, topic }: Props) {
  const [open, setOpen] = useState(true);

  const filtered = requests.filter((r) => r.topic === topic);

  const typeCounts = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.helpType] = (acc[r.helpType] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a).slice(0, 4);
  const maxType = topTypes[0]?.[1] ?? 1;

  const warnings: string[] = [];
  const welfareCount = filtered.filter((r) => r.helpType === "Welfare Check" && r.status !== "Fulfilled").length;
  const transportCount = filtered.filter((r) => r.helpType === "Transport Support" && r.status !== "Fulfilled").length;
  const medCount = filtered.filter((r) => r.helpType === "Medication Collection" && r.status !== "Fulfilled").length;
  if (welfareCount >= 2) warnings.push(`Welfare checks: ${welfareCount} open`);
  if (transportCount >= 2) warnings.push(`Transport: ${transportCount} open`);
  if (medCount >= 2) warnings.push(`Medication: ${medCount} open`);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Insights</span>
          {warnings.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">
              {warnings.length} gap{warnings.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Support gaps */}
          {warnings.length > 0 && (
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-amber-500">⚠</span>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Request categories */}
          <div className="space-y-2">
            {topTypes.map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate pr-2">{type}</span>
                  <span className="text-slate-400 shrink-0 font-medium">{count}</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${(count / maxType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

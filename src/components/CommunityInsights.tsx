"use client";

import type { HelpRequest, Topic } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
};

export default function CommunityInsights({ requests, topic }: Props) {
  const filtered = requests.filter((r) => r.topic === topic);

  // Top areas by demand
  const areaCounts = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.area] = (acc[r.area] ?? 0) + 1;
    return acc;
  }, {});
  const topAreas = Object.entries(areaCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  // Help type breakdown
  const typeCounts = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.helpType] = (acc[r.helpType] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const maxArea = topAreas[0]?.[1] ?? 1;
  const maxType = topTypes[0]?.[1] ?? 1;

  // Capacity warnings
  const warnings = [];
  const welfareCount = filtered.filter((r) => r.helpType === "Welfare Check" && r.status !== "Fulfilled").length;
  const transportCount = filtered.filter((r) => r.helpType === "Transport Support" && r.status !== "Fulfilled").length;
  const medCount = filtered.filter((r) => r.helpType === "Medication Collection" && r.status !== "Fulfilled").length;
  if (welfareCount >= 2) warnings.push(`Welfare checks nearing capacity (${welfareCount} open)`);
  if (transportCount >= 2) warnings.push(`Transport requests increasing (${transportCount} open)`);
  if (medCount >= 2) warnings.push(`Medication pickup backlog (${medCount} open)`);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Areas with highest demand */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Areas With Highest Demand</h3>
        <div className="space-y-3">
          {topAreas.map(([areaName, count]) => (
            <div key={areaName}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">{areaName}</span>
                <span className="text-slate-400">{count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${(count / maxArea) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support gaps */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Support Gaps</h3>
        {warnings.length > 0 ? (
          <ul className="space-y-2.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-amber-500 mt-0.5">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No capacity concerns at this time.</p>
        )}
      </div>

      {/* Request categories */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Request Categories</h3>
        <div className="space-y-3">
          {topTypes.map(([type, count]) => (
            <div key={type}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium truncate pr-2">{type}</span>
                <span className="text-slate-400 shrink-0">{count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full"
                  style={{ width: `${(count / maxType) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

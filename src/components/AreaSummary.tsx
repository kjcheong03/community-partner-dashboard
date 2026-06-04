"use client";

import type { HelpRequest, Topic } from "@/lib/types";

type Props = {
  area: string;
  requests: HelpRequest[];
  selectedTopic: "All" | Topic;
};

export default function AreaSummary({ area, requests, selectedTopic }: Props) {
  const areaReqs = requests
    .filter((r) => r.area === area)
    .filter((r) => selectedTopic === "All" || r.topic === selectedTopic);
  const open = areaReqs.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status));
  const highPriority = open.filter((r) => r.urgency === "High").length;
  const unfulfilled = areaReqs.filter((r) => r.status === "Unable To Fulfil").length;

  // Most common help type among open
  const typeCounts = open.reduce<Record<string, number>>((acc, r) => {
    acc[r.helpType] = (acc[r.helpType] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";

  // Assigned orgs
  const orgs = [...new Set(areaReqs.map((r) => r.assignedOrganisation).filter((o) => o !== "Unassigned"))];

  // Capacity warnings
  const warnings: string[] = [];
  if (open.filter((r) => r.helpType === "Clinic Transport Help").length >= 1)
    warnings.push("Clinic transport demand active");
  if (open.filter((r) => r.helpType === "Welfare Check").length >= 1)
    warnings.push("Welfare checks in queue");
  if (open.filter((r) => r.helpType === "Supplies & Networks").length >= 2)
    warnings.push("Supplies requests building up");
  if (open.filter((r) => r.urgency === "High").length >= 2)
    warnings.push("Multiple high-priority requests");

  const stats = [
    { label: "Open Requests", value: open.length, color: "text-blue-600" },
    { label: "High Priority", value: highPriority, color: "text-red-600" },
    { label: "Unable To Fulfil", value: unfulfilled, color: "text-slate-500" },
    { label: "Common Need", value: topType, color: "text-slate-700", small: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-6">
        {/* Area name + stats */}
        <div>
          <h3 className="font-semibold text-slate-800 mb-3">
            {area}
            <span className="ml-2 text-xs font-normal text-slate-400">{areaReqs.length} total requests</span>
          </h3>
          <div className="flex items-center gap-6">
            {stats.map(({ label, value, color, small }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                <p className={`font-bold ${color} ${small ? "text-sm" : "text-2xl"} leading-none`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings + orgs */}
        <div className="flex gap-6 shrink-0">
          {warnings.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Operational flags</p>
              <div className="space-y-1">
                {warnings.map((w) => (
                  <div key={w} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                    <span>⚠</span> {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {orgs.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Assigned partners</p>
              <div className="space-y-1">
                {orgs.slice(0, 3).map((org) => (
                  <div key={org} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                    {org}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

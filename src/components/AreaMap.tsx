"use client";

import type { HelpRequest, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
};

// Singapore planning areas grouped by region
const REGIONS: { name: string; areas: string[] }[] = [
  { name: "North", areas: ["Woodlands", "Yishun", "Sembawang"] },
  { name: "North-East", areas: ["Hougang", "Sengkang", "Punggol", "Serangoon"] },
  { name: "East", areas: ["Tampines", "Bedok", "Pasir Ris", "Kallang"] },
  { name: "Central", areas: ["Ang Mo Kio", "Toa Payoh", "Geylang"] },
  { name: "West", areas: ["Jurong West", "Jurong East", "Clementi", "Queenstown", "Bukit Merah"] },
];

function intensityClass(count: number, hasHigh: boolean): string {
  if (count === 0) return "bg-slate-100 text-slate-400 border-slate-200";
  if (hasHigh) return "bg-red-100 text-red-800 border-red-300";
  if (count >= 3) return "bg-blue-200 text-blue-900 border-blue-300";
  if (count === 2) return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export default function AreaMap({ requests, topic }: Props) {
  const filtered = requests.filter((r) => r.topic === topic);

  // Build per-area stats
  const areaStats = (area: string) => {
    const areaReqs = filtered.filter((r) => r.area === area);
    const hasHigh = areaReqs.some((r) => r.urgency === "High" && !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status));
    const open = areaReqs.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)).length;
    return { count: areaReqs.length, open, hasHigh };
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Area Overview</h3>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200 inline-block"/>None</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200 inline-block"/>Active</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block"/>High</span>
        </div>
      </div>

      <div className="space-y-2">
        {REGIONS.map(({ name, areas }) => (
          <div key={name} className="flex items-start gap-2">
            <span className="text-xs text-slate-400 w-16 shrink-0 pt-1.5 font-medium">{name}</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {areas.map((area) => {
                const { count, open, hasHigh } = areaStats(area);
                return (
                  <div
                    key={area}
                    className={cn(
                      "relative px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-default",
                      intensityClass(count, hasHigh)
                    )}
                    title={`${area}: ${count} requests, ${open} open`}
                  >
                    <span className="truncate max-w-[80px] block">{area}</span>
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-white text-[9px] flex items-center justify-center font-bold">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Colour indicates request activity · Red = high urgency open requests
      </p>
    </div>
  );
}

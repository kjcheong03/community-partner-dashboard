"use client";

import { cn } from "@/lib/utils";
import type { HelpRequest, Topic } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
  selectedArea: string | null;
  onSelectArea: (area: string | null) => void;
};

// Geographic grid positions [area, col, row] — 9 cols × 6 rows
const AREA_GRID: [string, number, number][] = [
  ["Woodlands",   3, 1],
  ["Sembawang",   4, 1],
  ["Punggol",     8, 1],
  ["Yishun",      5, 2],
  ["Sengkang",    7, 2],
  ["Ang Mo Kio",  5, 3],
  ["Hougang",     7, 3],
  ["Pasir Ris",   9, 3],
  ["Jurong West", 1, 4],
  ["Toa Payoh",   5, 4],
  ["Serangoon",   6, 4],
  ["Tampines",    8, 4],
  ["Jurong East", 2, 5],
  ["Clementi",    3, 5],
  ["Geylang",     6, 5],
  ["Bedok",       8, 5],
  ["Bukit Merah", 3, 6],
  ["Queenstown",  4, 6],
  ["Kallang",     6, 6],
];

function tileStyle(count: number, openCount: number, hasHighUrgency: boolean, isSelected: boolean): string {
  const base = "relative flex flex-col items-center justify-center h-12 rounded-lg border text-xs font-medium cursor-pointer transition-all duration-150 select-none";

  if (isSelected) {
    return cn(base, "ring-2 ring-blue-500 ring-offset-1",
      hasHighUrgency && openCount > 0
        ? "bg-red-200 border-red-400 text-red-900"
        : count === 0
        ? "bg-blue-100 border-blue-400 text-blue-800"
        : "bg-blue-300 border-blue-500 text-blue-950"
    );
  }

  if (count === 0) return cn(base, "bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200");
  if (hasHighUrgency && openCount > 0) return cn(base, "bg-red-100 border-red-300 text-red-800 hover:bg-red-200");
  if (openCount >= 3) return cn(base, "bg-blue-300 border-blue-400 text-blue-950 hover:bg-blue-400");
  if (openCount === 2) return cn(base, "bg-blue-200 border-blue-300 text-blue-900 hover:bg-blue-300");
  if (openCount === 1) return cn(base, "bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200");
  return cn(base, "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"); // fulfilled only
}

export default function SingaporeHeatmap({ requests, topic, selectedArea, onSelectArea }: Props) {
  const filtered = requests.filter((r) => r.topic === topic);

  function areaStats(area: string) {
    const areaReqs = filtered.filter((r) => r.area === area);
    const openReqs = areaReqs.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status));
    const hasHighUrgency = openReqs.some((r) => r.urgency === "High");
    return { count: areaReqs.length, openCount: openReqs.length, hasHighUrgency };
  }

  const totalOpen = filtered.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Singapore Needs Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedArea
              ? `Showing ${selectedArea} — click again to deselect`
              : `${totalOpen} open requests across all areas · click an area to filter`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" /> No requests
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300 inline-block" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> High urgency
          </span>
        </div>
      </div>

      {/* Geographic grid */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: "repeat(9, 1fr)",
          gridTemplateRows: "repeat(6, auto)",
        }}
      >
        {AREA_GRID.map(([area, col, row]) => {
          const { count, openCount, hasHighUrgency } = areaStats(area);
          const isSelected = selectedArea === area;

          return (
            <button
              key={area}
              onClick={() => onSelectArea(isSelected ? null : area)}
              className={tileStyle(count, openCount, hasHighUrgency, isSelected)}
              style={{ gridColumn: col, gridRow: row }}
              title={`${area}: ${count} requests, ${openCount} open`}
            >
              <span className="leading-tight text-center px-1 truncate w-full text-center" style={{ fontSize: "10px" }}>
                {area}
              </span>
              {count > 0 && (
                <span className="text-[9px] font-bold opacity-70">{openCount > 0 ? `${openCount} open` : "done"}</span>
              )}
              {/* High urgency pulse dot */}
              {hasHighUrgency && openCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

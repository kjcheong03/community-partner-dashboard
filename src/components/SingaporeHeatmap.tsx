"use client";

import type { HelpRequest } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  selectedArea: string | null;
  onSelectArea: (area: string | null) => void;
};

// Approximate geographic centroids in SVG coordinate space (viewBox 0 0 800 520)
// Derived from actual lat/lon: x = (lon - 103.62) / 0.40 * 800, y = (1.48 - lat) / 0.26 * 520
const AREAS: { name: string; x: number; y: number }[] = [
  { name: "Woodlands",   x: 358, y: 80  },
  { name: "Sembawang",   x: 400, y: 60  },
  { name: "Yishun",      x: 440, y: 96  },
  { name: "Punggol",     x: 556, y: 156 },
  { name: "Sengkang",    x: 536, y: 176 },
  { name: "Hougang",     x: 516, y: 220 },
  { name: "Ang Mo Kio",  x: 458, y: 220 },
  { name: "Serangoon",   x: 496, y: 260 },
  { name: "Pasir Ris",   x: 656, y: 220 },
  { name: "Tampines",    x: 636, y: 260 },
  { name: "Toa Payoh",   x: 458, y: 300 },
  { name: "Jurong West", x: 160, y: 280 },
  { name: "Jurong East", x: 238, y: 300 },
  { name: "Clementi",    x: 276, y: 340 },
  { name: "Queenstown",  x: 358, y: 360 },
  { name: "Bukit Merah", x: 398, y: 400 },
  { name: "Geylang",     x: 536, y: 320 },
  { name: "Kallang",     x: 496, y: 340 },
  { name: "Bedok",       x: 616, y: 320 },
];

// Simplified Singapore mainland outline (approximate)
const SINGAPORE_PATH = `
  M 22,385
  C 16,355 15,315 18,270
  C 20,220 28,178 48,140
  C 72,100 115,72 182,52
  C 240,35 312,28 390,26
  C 448,24 498,32 542,50
  C 588,68 628,96 668,128
  C 702,156 730,192 750,234
  C 764,266 768,302 758,342
  C 746,378 722,410 692,432
  C 658,455 614,466 566,470
  C 516,474 462,474 408,470
  C 356,466 304,456 256,440
  C 210,425 168,406 128,386
  C 90,368 55,360 22,385
  Z
`;

function bubbleRadius(openCount: number): number {
  if (openCount === 0) return 9;
  return Math.min(28, 12 + openCount * 4);
}

function bubbleColor(openCount: number, hasHigh: boolean): { fill: string; stroke: string } {
  if (openCount === 0) return { fill: "#f1f5f9", stroke: "#cbd5e1" };
  if (hasHigh) return { fill: "#fecaca", stroke: "#ef4444" };
  if (openCount >= 3) return { fill: "#60a5fa", stroke: "#2563eb" };
  if (openCount >= 2) return { fill: "#93c5fd", stroke: "#3b82f6" };
  return { fill: "#bfdbfe", stroke: "#60a5fa" };
}

export default function SingaporeHeatmap({ requests, selectedArea, onSelectArea }: Props) {
  function areaStats(areaName: string) {
    const areaReqs = requests.filter((r) => r.area === areaName);
    const openReqs = areaReqs.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status));
    const hasHigh = openReqs.some((r) => r.urgency === "High");
    return { total: areaReqs.length, openCount: openReqs.length, hasHigh };
  }

  const totalOpen = requests.filter(
    (r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
  ).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Singapore Needs Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedArea
              ? `${selectedArea} selected — click again to deselect`
              : `${totalOpen} open requests across all areas · click an area to filter`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300 inline-block" />
            Quiet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-200 border border-blue-400 inline-block" />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-200 border border-red-400 inline-block" />
            High urgency
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 800 500"
        className="w-full"
        style={{ maxHeight: 340 }}
      >
        {/* Water background */}
        <rect width="800" height="500" fill="#e0f2fe" rx="8" />

        {/* Singapore mainland */}
        <path
          d={SINGAPORE_PATH}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Area bubbles */}
        {AREAS.map(({ name, x, y }) => {
          const { openCount, hasHigh } = areaStats(name);
          const r = bubbleRadius(openCount);
          const { fill, stroke } = bubbleColor(openCount, hasHigh);
          const isSelected = selectedArea === name;
          const isDimmed = selectedArea !== null && !isSelected;

          return (
            <g
              key={name}
              onClick={() => onSelectArea(isSelected ? null : name)}
              className="cursor-pointer"
              style={{ opacity: isDimmed ? 0.35 : 1, transition: "opacity 0.15s" }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="4 2" />
              )}

              {/* Main bubble */}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
                className="transition-all duration-150"
              />

              {/* Count label inside bubble */}
              {openCount > 0 && (
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r > 16 ? 11 : 9}
                  fontWeight="700"
                  fill={hasHigh ? "#991b1b" : "#1e40af"}
                >
                  {openCount}
                </text>
              )}

              {/* Area name label below bubble */}
              <text
                x={x}
                y={y + r + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight={isSelected ? "700" : "500"}
                fill={isSelected ? "#1e40af" : "#475569"}
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

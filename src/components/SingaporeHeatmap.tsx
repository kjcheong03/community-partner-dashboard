"use client";

import type { HelpRequest } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  selectedArea: string | null;
  onSelectArea: (area: string | null) => void;
};

// Projection: x = (lon - 103.595) / 0.42 * 960, y = (1.485 - lat) / 0.275 * 620
// Tuned to fit Singapore mainland in ~960×620 with padding
function proj(lon: number, lat: number): [number, number] {
  return [
    Math.round(((lon - 103.595) / 0.42) * 960),
    Math.round(((1.485 - lat) / 0.275) * 620),
  ];
}

function pt(lon: number, lat: number) {
  const [x, y] = proj(lon, lat);
  return `${x},${y}`;
}

// Singapore mainland outline — clockwise from Tuas (west tip)
// ~40 key coastline waypoints derived from actual coordinates
const OUTLINE = [
  pt(103.637, 1.289), // Tuas SW
  pt(103.638, 1.336),
  pt(103.638, 1.380),
  pt(103.641, 1.412),
  pt(103.651, 1.437),
  pt(103.670, 1.447),
  pt(103.700, 1.453), // Woodlands north coast starts
  pt(103.745, 1.454),
  pt(103.800, 1.453),
  pt(103.840, 1.452),
  pt(103.865, 1.448),
  pt(103.893, 1.437),
  pt(103.913, 1.426),
  pt(103.935, 1.406),
  pt(103.957, 1.384),
  pt(103.978, 1.363),
  pt(103.993, 1.348),
  pt(104.001, 1.336),
  pt(104.002, 1.320),
  pt(103.994, 1.304),
  pt(103.977, 1.290),
  pt(103.961, 1.278),
  pt(103.940, 1.267),
  pt(103.912, 1.257),
  pt(103.884, 1.252),
  pt(103.851, 1.250),
  pt(103.819, 1.250),
  pt(103.795, 1.255),
  pt(103.772, 1.264),
  pt(103.750, 1.272),
  pt(103.723, 1.276),
  pt(103.697, 1.279),
  pt(103.671, 1.282),
  pt(103.651, 1.286),
  pt(103.637, 1.289), // back to Tuas
].join(" ");

// Planning area definitions — centroid (lon, lat) + label offset
// Centroids derived from URA planning area boundaries
const AREAS: {
  name: string;
  lon: number;
  lat: number;
  labelDy?: number;
}[] = [
  { name: "Woodlands",   lon: 103.793, lat: 1.437, labelDy: 14 },
  { name: "Sembawang",   lon: 103.820, lat: 1.448, labelDy: 14 },
  { name: "Yishun",      lon: 103.836, lat: 1.428, labelDy: 14 },
  { name: "Punggol",     lon: 103.906, lat: 1.403, labelDy: 14 },
  { name: "Sengkang",    lon: 103.893, lat: 1.391, labelDy: 14 },
  { name: "Hougang",     lon: 103.876, lat: 1.371, labelDy: 14 },
  { name: "Ang Mo Kio",  lon: 103.848, lat: 1.369, labelDy: 14 },
  { name: "Serangoon",   lon: 103.873, lat: 1.350, labelDy: 14 },
  { name: "Pasir Ris",   lon: 103.951, lat: 1.374, labelDy: 14 },
  { name: "Tampines",    lon: 103.943, lat: 1.352, labelDy: 14 },
  { name: "Toa Payoh",   lon: 103.848, lat: 1.332, labelDy: 14 },
  { name: "Kallang",     lon: 103.869, lat: 1.312, labelDy: 14 },
  { name: "Geylang",     lon: 103.893, lat: 1.322, labelDy: 14 },
  { name: "Bedok",       lon: 103.930, lat: 1.321, labelDy: 14 },
  { name: "Jurong West", lon: 103.700, lat: 1.348, labelDy: 14 },
  { name: "Jurong East", lon: 103.742, lat: 1.334, labelDy: 14 },
  { name: "Clementi",    lon: 103.765, lat: 1.314, labelDy: 14 },
  { name: "Queenstown",  lon: 103.800, lat: 1.302, labelDy: 14 },
  { name: "Bukit Merah", lon: 103.819, lat: 1.282, labelDy: 14 },
];

function bubbleRadius(openCount: number): number {
  if (openCount === 0) return 7;
  return Math.min(26, 11 + openCount * 4);
}

type BubbleStyle = { fill: string; stroke: string; textFill: string };

function bubbleStyle(openCount: number, hasHigh: boolean): BubbleStyle {
  if (openCount === 0) return { fill: "#f1f5f9", stroke: "#cbd5e1", textFill: "#94a3b8" };
  if (hasHigh)         return { fill: "#fecaca", stroke: "#f87171", textFill: "#b91c1c" };
  if (openCount >= 4)  return { fill: "#60a5fa", stroke: "#2563eb", textFill: "#1e3a8a" };
  if (openCount >= 2)  return { fill: "#93c5fd", stroke: "#3b82f6", textFill: "#1e40af" };
  return                      { fill: "#bfdbfe", stroke: "#60a5fa", textFill: "#1d4ed8" };
}

export default function SingaporeHeatmap({ requests, selectedArea, onSelectArea }: Props) {
  const totalOpen = requests.filter(
    (r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
  ).length;

  function areaStats(name: string) {
    const areaReqs = requests.filter((r) => r.area === name);
    const openReqs = areaReqs.filter(
      (r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
    );
    return {
      openCount: openReqs.length,
      hasHigh: openReqs.some((r) => r.urgency === "High"),
    };
  }

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
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1"/></svg>
            Quiet
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#93c5fd" stroke="#3b82f6" strokeWidth="1"/></svg>
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#fecaca" stroke="#f87171" strokeWidth="1"/></svg>
            High urgency
          </span>
        </div>
      </div>

      <svg viewBox="0 0 960 620" className="w-full" style={{ maxHeight: 320 }}>
        {/* Water */}
        <rect width="960" height="620" fill="#dbeafe" rx="6" />

        {/* Singapore mainland */}
        <polygon
          points={OUTLINE}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Planning area bubbles */}
        {AREAS.map(({ name, lon, lat, labelDy = 14 }) => {
          const [cx, cy] = proj(lon, lat);
          const { openCount, hasHigh } = areaStats(name);
          const r = bubbleRadius(openCount);
          const { fill, stroke, textFill } = bubbleStyle(openCount, hasHigh);
          const isSelected = selectedArea === name;
          const isDimmed = selectedArea !== null && !isSelected;

          return (
            <g
              key={name}
              onClick={() => onSelectArea(isSelected ? null : name)}
              style={{
                cursor: "pointer",
                opacity: isDimmed ? 0.3 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={cx} cy={cy} r={r + 6}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}

              {/* Bubble */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
              />

              {/* Count */}
              {openCount > 0 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={r >= 16 ? 11 : 9}
                  fontWeight="700"
                  fill={textFill}
                >
                  {openCount}
                </text>
              )}

              {/* Label */}
              <text
                x={cx} y={cy + r + labelDy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight={isSelected ? "700" : "500"}
                fill={isSelected ? "#1d4ed8" : "#64748b"}
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

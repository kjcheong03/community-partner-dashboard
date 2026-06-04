"use client";

import { TrendingUp, Lightbulb } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { HelpRequest } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { charts, insights, type ChartSpec } from "@/lib/analytics";

const PIE_COLORS = ["#2563eb", "#0d9488", "#f59e0b", "#a855f7", "#ec4899", "#16a34a", "#64748b"];

function renderPieLabel(entry: { label?: string; value?: number }): string {
  return `${entry.label ?? ""} (${entry.value ?? 0})`;
}

type Props = { org: OrgId; requests: HelpRequest[] };

export default function GroundTrends({ org, requests }: Props) {
  const [primary, secondary] = charts(org, requests);
  const observations = insights(org, requests);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        <TrendingUp size={13} className="text-blue-500" /> Ground Trends
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard spec={primary} />
        <ChartCard spec={secondary} />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          <Lightbulb size={13} className="text-amber-500" /> Support Gaps & Insights
        </h3>
        {observations.length === 0 ? (
          <p className="text-sm text-slate-400">No notable patterns in the current data.</p>
        ) : (
          <ul className="space-y-1.5">
            {observations.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="leading-relaxed">{o}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChartCard({ spec }: { spec: ChartSpec }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{spec.title}</p>
      <div className="h-44">
        {spec.data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">No data</div>
        ) : spec.kind === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spec.data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={spec.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={72} label={renderPieLabel} labelLine={false} fontSize={10}>
                {spec.data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

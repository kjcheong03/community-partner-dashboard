"use client";

import type { HelpRequest } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { statCards, type Accent } from "@/lib/analytics";

const ACCENT: Record<Accent, string> = {
  blue: "text-blue-600",
  red: "text-red-600",
  green: "text-green-600",
  amber: "text-amber-600",
  purple: "text-purple-600",
  slate: "text-slate-600",
  teal: "text-teal-600",
};

type Props = { org: OrgId; requests: HelpRequest[] };

export default function StatCards({ org, requests }: Props) {
  const cards = statCards(org, requests);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium truncate">{c.label}</p>
            {c.hint && <p className="text-[10px] text-slate-400 truncate">{c.hint}</p>}
          </div>
          <p className={`text-xl font-bold ${ACCENT[c.accent]}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

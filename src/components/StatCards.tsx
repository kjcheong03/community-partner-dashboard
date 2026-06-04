"use client";

import { AlertTriangle, Boxes, ClipboardList, HeartPulse, Languages, type LucideIcon, Package, Users } from "lucide-react";
import type { HelpRequest } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { statCards, type Accent } from "@/lib/analytics";

const ACCENT: Record<Accent, { border: string; value: string; icon: string }> = {
  blue: { border: "border-blue-200", value: "text-blue-700", icon: "text-slate-400" },
  red: { border: "border-red-200", value: "text-red-700", icon: "text-slate-400" },
  green: { border: "border-emerald-200", value: "text-emerald-700", icon: "text-slate-400" },
  amber: { border: "border-amber-200", value: "text-amber-700", icon: "text-slate-400" },
  purple: { border: "border-purple-200", value: "text-purple-700", icon: "text-slate-400" },
  slate: { border: "border-slate-200", value: "text-slate-700", icon: "text-slate-400" },
  teal: { border: "border-teal-200", value: "text-teal-700", icon: "text-slate-400" },
};

type Props = { org: OrgId; requests: HelpRequest[] };

function iconFor(label: string): LucideIcon {
  if (label.includes("volunteer")) return Users;
  if (label.includes("Language")) return Languages;
  if (label.includes("stock") || label.includes("supplies") || label.includes("Products")) return Boxes;
  if (label.includes("care") || label.includes("Domain")) return HeartPulse;
  if (label.includes("priority") || label.includes("urgent")) return AlertTriangle;
  if (label.includes("team") || label.includes("unit") || label.includes("slot")) return ClipboardList;
  return Package;
}

export default function StatCards({ org, requests }: Props) {
  const cards = statCards(org, requests);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => {
        const tone = ACCENT[c.accent];
        const Icon = iconFor(c.label);
        return (
          <div key={c.label} className={`bg-white rounded-lg border ${tone.border} px-5 py-4 min-h-[108px] shadow-sm flex items-start justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-sm text-slate-700 font-medium truncate">{c.label}</p>
              <p className={`mt-3 text-3xl leading-none font-bold ${tone.value}`}>{c.value}</p>
              {c.hint && <p className="mt-1 text-xs text-slate-400 truncate">{c.hint}</p>}
            </div>
            <Icon size={29} strokeWidth={2} className={`${tone.icon} shrink-0 mt-1`} />
          </div>
        );
      })}
    </div>
  );
}

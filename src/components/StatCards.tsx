"use client";

import { AlertTriangle, Boxes, ClipboardList, HeartPulse, Languages, type LucideIcon, Package, Users } from "lucide-react";
import type { HelpRequest } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { statCards, type Accent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Three levels of emphasis only — alert (red) reads loudest, watch (amber)
// is a quiet accent, everything else is neutral. This is what gives the strip
// a clear hierarchy instead of four equally-loud cards.
type Severity = "alert" | "watch" | "neutral";

function severityOf(accent: Accent): Severity {
  if (accent === "red") return "alert";
  if (accent === "amber") return "watch";
  return "neutral";
}

const SEVERITY: Record<Severity, { card: string; value: string; chip: string }> = {
  alert: {
    card: "border-red-200 bg-red-50/40",
    value: "text-red-700",
    chip: "bg-red-100 text-red-600",
  },
  watch: {
    card: "border-slate-200 bg-white",
    value: "text-amber-700",
    chip: "bg-amber-100 text-amber-600",
  },
  neutral: {
    card: "border-slate-200 bg-white",
    value: "text-slate-900",
    chip: "bg-slate-100 text-slate-400",
  },
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => {
        const tone = SEVERITY[severityOf(c.accent)];
        const Icon = iconFor(c.label);
        return (
          <div
            key={c.label}
            className={cn("flex items-center justify-between gap-3 rounded-lg border px-4 py-3.5 shadow-sm", tone.card)}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{c.label}</p>
              <p className={cn("mt-2 text-3xl font-semibold leading-none tracking-tight", tone.value)}>{c.value}</p>
              {c.hint && <p className="mt-1.5 truncate text-[11px] text-slate-400">{c.hint}</p>}
            </div>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.chip)}>
              <Icon size={16} strokeWidth={2} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: ReactNode;
  hint?: string;
  /** alert = loudest (red), watch = amber accent, neutral = quiet. Default neutral. */
  tone?: "alert" | "watch" | "neutral";
  icon?: ReactNode;
};

const TONE = {
  alert: { card: "border-red-200 bg-red-50/40", value: "text-red-700", chip: "bg-red-100 text-red-600" },
  watch: { card: "border-slate-200 bg-white", value: "text-amber-700", chip: "bg-amber-100 text-amber-600" },
  neutral: { card: "border-slate-200 bg-white", value: "text-slate-900", chip: "bg-slate-100 text-slate-400" },
} as const;

export default function KPIStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      {items.map((k) => {
        const tone = TONE[k.tone ?? "neutral"];
        return (
          <div key={k.label} className={cn("flex items-center justify-between gap-3 rounded-lg border px-4 py-3.5 shadow-sm", tone.card)}>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{k.label}</p>
              <p className={cn("mt-2 text-3xl font-semibold leading-none tracking-tight", tone.value)}>{k.value}</p>
              {k.hint && <p className="mt-1.5 truncate text-[11px] text-slate-400">{k.hint}</p>}
            </div>
            {k.icon && <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.chip)}>{k.icon}</span>}
          </div>
        );
      })}
    </div>
  );
}

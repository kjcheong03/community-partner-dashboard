import { cn } from "@/lib/utils";

export type FilterTab = { value: string; label: string; count?: number };

// Generic controlled tab/filter bar (by status / type / area / …). Calm by
// default — the active tab is a soft fill, not a loud colour.
export default function FiltersTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: FilterTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  "rounded px-1 text-[10px] font-semibold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

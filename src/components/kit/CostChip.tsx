import { cn } from "@/lib/utils";

// Deliberately decoupled from the contract's CostEstimate: callers pass a
// pre-formatted label + tone. A `formatCost(estimate)` helper in the
// contract/mock layer will produce these once contract.ts lands.
export type CostTone = "free" | "fixed" | "estimated" | "review";

const TONE: Record<CostTone, string> = {
  free: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  fixed: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  estimated: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  review: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
};

export default function CostChip({
  text,
  tone = "fixed",
  className,
}: {
  text: string;
  tone?: CostTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
        className
      )}
    >
      {text}
    </span>
  );
}

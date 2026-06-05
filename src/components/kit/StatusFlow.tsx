import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/contract";
import { statusStyle } from "./theme";

// Compact active-work pipeline. Only the live stages (Pending → Accepted →
// In progress); closed states live in the Closed tab, not here. High priority
// is a leading red accent. Sizes to content — not full screen width.
const FLOW: RequestStatus[] = ["Pending", "Accepted", "In progress"];

export default function StatusFlow({
  counts,
  highCount = 0,
  className,
}: {
  counts: Record<RequestStatus, number>;
  highCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("ops-card flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2", className)}>
      {highCount > 0 && (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
            <AlertTriangle size={14} />
            {highCount} high priority
          </span>
          <span className="mx-0.5 h-5 w-px bg-slate-200" />
        </>
      )}

      {FLOW.map((stage, i) => (
        <span key={stage} className="flex items-center gap-1">
          <Stage stage={stage} count={counts[stage]} />
          {i < FLOW.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
        </span>
      ))}
    </div>
  );
}

function Stage({ stage, count }: { stage: RequestStatus; count: number }) {
  const s = statusStyle(stage);
  const dim = count === 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", dim ? "text-slate-400" : s.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dim ? "bg-slate-300" : s.dot)} />
      {stage}
      <span className="font-semibold tabular-nums">{count}</span>
    </span>
  );
}

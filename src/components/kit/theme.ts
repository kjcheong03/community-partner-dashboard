// ---------------------------------------------------------------------------
// ORCA partner-dashboard kit — shared design layer.
//
// This is the ONE owned styling layer the whole kit consumes. Colour encodes
// STATE, never decoration (the brief: "use colour to communicate state").
//
// Keyed by the canonical RequestStatus string literals. These are *data*, not a
// type declaration — the RequestStatus union lives in the shared contract
// (orca/contract.ts). When that lands, annotate the maps with
// `satisfies Record<RequestStatus, ChipStyle>`; no duplicate union is created.
// ---------------------------------------------------------------------------

export const REQUEST_STATUSES = [
  "Pending",
  "Accepted",
  "In progress",
  "Completed",
  "Rejected",
  "Cancelled",
] as const;

export type ChipStyle = { pill: string; dot: string };

// Six distinct-but-restrained tints. Status is the one place colour legitimately
// carries distinct state, so each step reads differently while staying calm.
export const STATUS_STYLES: Record<string, ChipStyle> = {
  Pending: { pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200", dot: "bg-blue-500" },
  Accepted: { pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200", dot: "bg-indigo-500" },
  "In progress": { pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", dot: "bg-amber-500" },
  "Meal plan confirmed": { pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200", dot: "bg-indigo-500" },
  "Added to MOW schedule": { pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", dot: "bg-amber-500" },
  "Preparing meals": { pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", dot: "bg-amber-500" },
  Packing: { pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", dot: "bg-amber-500" },
  "Ready for pickup": { pill: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200", dot: "bg-cyan-500" },
  "Out for delivery": { pill: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200", dot: "bg-cyan-500" },
  Scheduled: { pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200", dot: "bg-indigo-500" },
  Rescheduled: { pill: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200", dot: "bg-violet-500" },
  Completed: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", dot: "bg-emerald-500" },
  Rejected: { pill: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200", dot: "bg-red-500" },
  Cancelled: { pill: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200", dot: "bg-slate-400" },
};

export const FALLBACK_STATUS_STYLE: ChipStyle = {
  pill: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  dot: "bg-slate-400",
};

export function statusStyle(status: string): ChipStyle {
  return STATUS_STYLES[status] ?? FALLBACK_STATUS_STYLE;
}

// --- urgency ---------------------------------------------------------------
// Only High reads loud; Low is neutral. Mirrors the dashboard hierarchy rule.

export type UrgencyTier = "High" | "Medium" | "Low";

export const URGENCY_STYLES: Record<UrgencyTier, ChipStyle> = {
  High: { pill: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200", dot: "bg-red-500" },
  Medium: { pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", dot: "bg-amber-500" },
  Low: { pill: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200", dot: "bg-green-500" },
};

// Producer timing strings → urgency tier. Different support types phrase timing
// differently (neededBy / urgency / checkInDay / startDate / duration).
export function urgencyFromNeededBy(v?: string): UrgencyTier {
  if (!v) return "Low";
  if (v === "Today" || v === "Today only") return "High";
  if (["Tomorrow", "2–3 days", "2-3 days", "Within 2–3 days", "Within 2-3 days"].includes(v)) return "Medium";
  return "Low";
}

// --- fulfilment route type (informational, neutral) ------------------------

export const ROUTE_TYPE_LABELS: Record<string, string> = {
  public_distribution: "Public distribution",
  community_distribution: "Community distribution",
  partner_service: "Partner service",
};

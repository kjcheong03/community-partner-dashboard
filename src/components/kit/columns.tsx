import { cn } from "@/lib/utils";
import type { WorkItem } from "@/lib/contract";
import { requestRef, routeDisplayStatus, supportTypeLabels, taskDisplayStatus } from "@/lib/contract";
import { URGENCY_STYLES } from "./theme";
import { SUPPORT_ICON, costForItem, deriveUrgency, formatSubmitted, neededByLabel, neededBySortKey } from "./format";
import type { QueueColumn } from "./RequestQueue";
import StatusBadge from "./StatusBadge";

// Full column superset the request data can support. Each accessor renders
// something sensible for every WorkItem kind (partner-task / food-route /
// supplies-route) or a clean "—" when genuinely N/A — never blank or [object Object].
//
// NOTE: deriveUrgency / neededByLabel are interim in format.ts until CARA exports
// them from contract.ts; re-point those imports on the next contract sync.

const URGENCY_RANK = { High: 0, Medium: 1, Low: 2 } as const;
const STATUS_RANK = { Pending: 0, Accepted: 1, "In progress": 2, Completed: 3, Rejected: 4, Cancelled: 5 } as const;

const dash = (s?: string | null) => (s && s.trim() ? s : "—");
const shortRequestRef = (sessionId: string) => requestRef(sessionId).replace(/^REQ-/, "#");

function displayStatus(it: WorkItem): string {
  return it.route ? routeDisplayStatus(it.task, it.route) : taskDisplayStatus(it.task);
}

// Subtype / items summary: supplies route → "Masks ×1"; food route → its
// label; partner/food task → selected subtypes.
function detailSummary(it: WorkItem): string {
  if (it.kind === "supplies-route" && it.route) {
    return it.route.quantity != null ? `${it.route.label} ×${it.route.quantity}` : it.route.label;
  }
  if (it.kind === "food-route" && it.route?.label === "Cooked meals") return cookedMealSummary(it);
  if (it.kind === "food-route" && it.route?.label === "Food pack / rations") return foodPackSummary(it);
  if (it.kind === "food-route" && it.route) return it.route.label;
  const subs = it.task.selectedSubtypes;
  return subs && subs.length ? subs.join(", ") : "—";
}

function cookedMealSummary(it: WorkItem): string {
  const details = it.task.details ?? {};
  const meals = Array.isArray(details.mealsNeeded) ? details.mealsNeeded.map(String) : [];
  const mealLabel = meals.includes("Lunch") && meals.includes("Dinner")
    ? "Both"
    : meals.includes("Lunch")
      ? "Lunch"
      : meals.includes("Dinner")
        ? "Dinner"
        : "Meal";
  return `${mealLabel} / ${dietaryVariant(details)}`;
}

function foodPackSummary(it: WorkItem): string {
  const packType = it.task.details?.packType;
  if (packType === "Standard food pack / rations") return "Standard food pack";
  if (packType === "Food pack with fresh add-ons, if available") return "Fresh food pack";
  return typeof packType === "string" && packType.trim() ? packType.replace(" / rations", "") : "Food pack";
}

function dietaryVariant(details: Record<string, unknown>): string {
  const restrictions = Array.isArray(details.dietaryRestrictions)
    ? details.dietaryRestrictions.map(String).filter(Boolean)
    : [];
  const other = String(details.dietaryRestrictionsOther ?? "").trim();
  if (!restrictions.length && !other) return "Regular";
  if (other || restrictions.includes("Other") || restrictions.length > 1) return "Special";
  const [restriction] = restrictions;
  return ["Halal", "Vegetarian", "Soft food", "Low sugar", "Low salt"].includes(restriction) ? restriction : "Special";
}

export const REQUEST_COLUMNS: Record<string, QueueColumn> = {
  id: {
    key: "id",
    header: "ID",
    core: true,
    width: 60,
    value: (it) => requestRef(it.sessionId),
    cell: (it) => <span className="font-mono font-medium text-slate-400">{shortRequestRef(it.sessionId)}</span>,
  },
  submittedBy: {
    key: "submittedBy",
    header: "Submitted by",
    core: true,
    width: 130,
    value: (it) => it.session.caregiverName,
    cell: (it) => (
      <div className="leading-tight">
        <div className="truncate font-medium text-slate-700">{dash(it.session.caregiverName)}</div>
        <div className="truncate text-[11px] text-slate-400">for {dash(it.session.careRecipientName)}</div>
      </div>
    ),
  },
  careRecipient: {
    key: "careRecipient",
    header: "Care recipient",
    width: 105,
    value: (it) => dash(it.session.careRecipientName),
    cell: (it) => <span className="text-slate-600">{dash(it.session.careRecipientName)}</span>,
  },
  type: {
    key: "type",
    header: "Type",
    width: 220,
    value: (it) => supportTypeLabels[it.supportType],
    cell: (it) => {
      const Icon = SUPPORT_ICON[it.supportType];
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600">
          <Icon size={13} className="shrink-0 text-slate-400" />
          <span className="min-w-0 truncate">{supportTypeLabels[it.supportType]}</span>
        </span>
      );
    },
  },
  detail: {
    key: "detail",
    header: "Detail / items",
    width: 176,
    value: detailSummary,
    cell: (it) => <span className="text-slate-600">{detailSummary(it)}</span>,
  },
  area: {
    key: "area",
    header: "Area",
    width: 86,
    value: (it) => dash(it.session.generalArea),
    cell: (it) => <span className="text-slate-500">{dash(it.session.generalArea)}</span>,
  },
  priority: {
    key: "priority",
    header: "Priority",
    width: 82,
    value: (it) => deriveUrgency(it.task, it.session.createdAt),
    sortValue: (it) => URGENCY_RANK[deriveUrgency(it.task, it.session.createdAt)],
    cell: (it) => {
      const u = deriveUrgency(it.task, it.session.createdAt);
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
          <span className={cn("h-1.5 w-1.5 rounded-full", URGENCY_STYLES[u].dot)} />
          {u}
        </span>
      );
    },
  },
  neededBy: {
    key: "neededBy",
    header: "Needed by",
    width: 100,
    value: (it) => neededByLabel(it.task, it.session.createdAt),
    sortValue: (it) => neededBySortKey(it.task, it.session.createdAt),
    cell: (it) => <span className="text-slate-600">{neededByLabel(it.task, it.session.createdAt)}</span>,
  },
  submitted: {
    key: "submitted",
    header: "Submitted",
    width: 110,
    value: (it) => it.session.createdAt,
    cell: (it) => <span className="text-slate-400">{formatSubmitted(it.session.createdAt)}</span>,
  },
  cost: {
    key: "cost",
    header: "Cost",
    width: 90,
    value: (it) => costForItem(it).text,
    cell: (it) => <span className="text-slate-600">{costForItem(it).text}</span>,
  },
  status: {
    key: "status",
    header: "Status",
    core: true,
    width: 138,
    value: (it) => displayStatus(it),
    sortValue: (it) => STATUS_RANK[it.status],
    cell: (it) => <StatusBadge status={displayStatus(it)} />,
  },
};

// The complete superset, in display order. (Role + Assigned-to are intentionally
// absent: backups aren't shown, and no roster model is decided.)
export const ALL_COLUMN_KEYS = [
  "id",
  "submittedBy",
  "careRecipient",
  "type",
  "detail",
  "area",
  "priority",
  "neededBy",
  "submitted",
  "cost",
  "status",
];

export function pickColumns(keys: string[]): QueueColumn[] {
  return keys.map((k) => REQUEST_COLUMNS[k]).filter(Boolean);
}

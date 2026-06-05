// Presentation helpers the kit's data-driven components share. Pure, contract-typed.

import { Boxes, HeartPulse, Soup, Truck, Compass, type LucideIcon } from "lucide-react";
import {
  deriveUrgency as contractDeriveUrgency,
  detailRows as contractDetailRows,
  neededByLabel as contractNeededByLabel,
  type CostEstimate,
  type DetailRow as ContractDetailRow,
  type RequestTaskSession,
  type SupportTypeId,
  type UrgencyTier as ContractUrgencyTier,
  type WorkItem,
} from "@/lib/contract";
import type { UrgencyTier } from "./theme";
import type { CostTone } from "./CostChip";

export const SUPPORT_ICON: Record<SupportTypeId, LucideIcon> = {
  supplies: Boxes,
  food: Soup,
  welfare: HeartPulse,
  transport: Truck,
  referral: Compass,
};

const URGENCY_LABEL: Record<ContractUrgencyTier, UrgencyTier> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type DetailRow = ContractDetailRow & { long?: boolean };

export function deriveUrgency(task: RequestTaskSession, createdAt?: string): UrgencyTier {
  return URGENCY_LABEL[contractDeriveUrgency(task, createdAt)];
}

export function formatCost(estimate?: CostEstimate): { text: string; tone: CostTone } {
  if (!estimate) return { text: "—", tone: "review" };
  const tone: CostTone =
    estimate.costType === "free" ? "free" : estimate.costType === "estimated" ? "estimated" : estimate.costType === "partnerReview" ? "review" : "fixed";
  if (estimate.label) return { text: estimate.label, tone };
  switch (estimate.costType) {
    case "free":
      return { text: "Free", tone: "free" };
    case "partnerReview":
      return { text: "Partner assessment", tone: "review" };
    case "estimated":
      return { text: `$${fmt(estimate.min)}–$${fmt(estimate.max)}`, tone: "estimated" };
    case "fixed":
      return { text: `$${fmt(estimate.total)}`, tone: "fixed" };
    default:
      return { text: "Mixed", tone: "fixed" };
  }
}

function fmt(n?: number): string {
  return n == null ? "0" : n.toFixed(2).replace(/\.00$/, "");
}

// Cost varies by work-item kind: food routes carry a per-route costLabel,
// supplies are free public distribution, partner tasks carry a costEstimate.
export function costForItem(item: WorkItem): { text: string; tone: CostTone } {
  if (item.kind === "food-route" && item.route) {
    const label = item.route.costLabel;
    return { text: label, tone: /free/i.test(label) ? "free" : "estimated" };
  }
  if (item.kind === "supplies-task") return { text: "Free", tone: "free" };
  return formatCost(item.task.costEstimate);
}

export function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function neededByLabel(task: RequestTaskSession, createdAt: string): string {
  return contractNeededByLabel(task, createdAt) || "—";
}

// Sortable key for "Needed by" — epoch ms of the implied earliest due date, so
// the column sorts chronologically rather than by label text.
export function neededBySortKey(task: RequestTaskSession, createdAt: string): number {
  const d = task.details ?? {};
  const at = (iso: string) => new Date(iso).getTime();
  if (typeof d.appointmentDateTime === "string") return at(d.appointmentDateTime);
  if (typeof d.checkInDayValue === "string") return at(d.checkInDayValue);
  if (typeof d.startDateValue === "string") return at(d.startDateValue);
  const base = at(createdAt);
  const day = 86_400_000;
  const phrase = (d.checkInDay ?? d.startDate ?? d.neededBy ?? d.urgency ?? d.duration) as string | undefined;
  switch (phrase) {
    case "Today":
    case "Today only":
      return base;
    case "Tomorrow":
      return base + day;
    case "Within 2–3 days":
    case "Within 2-3 days":
    case "2–3 days":
    case "2-3 days":
      return base + 2 * day;
    case "This week":
      return base + 5 * day;
    case "Not urgent":
      return base + 30 * day;
    default:
      return base;
  }
}

export function detailRows(task: RequestTaskSession, focusSubtype?: string): DetailRow[] {
  return contractDetailRows(task, focusSubtype);
}

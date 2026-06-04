import type { HelpRequest } from "./types";
import type { OrgId } from "./orgs";
import { areaMarkers } from "@/data/areaMarkers";

// Fixed reference "now" so time-based metrics are stable against the mock dataset.
export const NOW = new Date("2025-06-03T12:00:00");

const CLOSED = new Set(["Fulfilled", "Unable To Fulfil", "Rerouted"]);

export function isOpen(r: HelpRequest): boolean {
  return !CLOSED.has(r.status);
}

function hoursSince(iso: string): number {
  return (NOW.getTime() - new Date(iso).getTime()) / 36e5;
}

function regionOf(area: string): string {
  return areaMarkers.find((a) => a.name === area)?.region ?? "Other";
}

export type Accent = "blue" | "red" | "green" | "amber" | "purple" | "slate" | "teal";

export type StatCard = { label: string; value: number; accent: Accent; hint?: string };

export type ChartDatum = { label: string; value: number };

export type ChartSpec = { title: string; kind: "bar" | "pie"; data: ChartDatum[] };

// Recipients who appear in 2+ requests — repeat households worth a care review.
export function repeatRecipientNames(requests: HelpRequest[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r.recipient.name, (counts.get(r.recipient.name) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name));
}

function countBy(requests: HelpRequest[], key: (r: HelpRequest) => string): ChartDatum[] {
  const m = new Map<string, number>();
  for (const r of requests) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function statCards(org: OrgId, requests: HelpRequest[]): StatCard[] {
  if (org === "AIC") {
    const flagged = requests.filter((r) => r.flaggedForCareReview);
    return [
      { label: "Total incidents", value: requests.length, accent: "blue", hint: "across all partners" },
      { label: "Flagged for care review", value: flagged.length, accent: "purple" },
      { label: "Repeat households", value: repeatRecipientNames(requests).size, accent: "amber", hint: "2+ requests" },
      { label: "Open care reviews", value: flagged.filter(isOpen).length, accent: "red" },
    ];
  }
  if (org === "SGCares") {
    const open = requests.filter(isOpen);
    const unassigned = open.filter((r) => !r.assignedTeam || r.assignedOrganisation === "Unassigned");
    const languageSupport = open.filter((r) => r.riskFactors.includes("Language Support Needed"));
    return [
      { label: "Open requests", value: open.length, accent: "blue" },
      { label: "Urgent", value: open.filter((r) => r.urgency === "High").length, accent: "red" },
      { label: "Unassigned open", value: unassigned.length, accent: "amber", hint: "needs team" },
      { label: "Language support", value: languageSupport.length, accent: "purple", hint: "dialect / translation" },
    ];
  }
  // Pharmacy partner
  const open = requests.filter(isOpen);
  const highRisk = open.filter((r) => r.medications?.some((m) => m.highRisk));
  const coldChain = open.filter(
    (r) =>
      r.helpTags.includes("Refrigerated medication") ||
      r.medications?.some((m) => m.category === "Insulin")
  );
  const unrouted = open.filter((r) => !r.pharmacyBranch);
  return [
    { label: "Open medication requests", value: open.length, accent: "teal" },
    { label: "High-risk meds", value: highRisk.length, accent: "red", hint: "clinical sign-off" },
    { label: "Cold-chain handling", value: coldChain.length, accent: "purple", hint: "insulin / refrigerated" },
    { label: "Unrouted to branch", value: unrouted.length, accent: "amber" },
  ];
}

export function charts(org: OrgId, requests: HelpRequest[]): [ChartSpec, ChartSpec] {
  if (org === "AIC") {
    return [
      { title: "Incident volume by area", kind: "bar", data: countBy(requests, (r) => r.area).slice(0, 8) },
      { title: "Partner workload", kind: "pie", data: countBy(requests, (r) => r.assignedOrganisation) },
    ];
  }
  if (org === "SGCares") {
    return [
      { title: "Request volume by sector", kind: "bar", data: countBy(requests, (r) => regionOf(r.area)) },
      { title: "Breakdown by help type", kind: "pie", data: countBy(requests, (r) => r.helpType) },
    ];
  }
  // Pharmacy partner
  const medCategory = (r: HelpRequest) => r.medications?.map((m) => m.category) ?? [];
  const catCounts = new Map<string, number>();
  for (const r of requests) for (const c of medCategory(r)) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  const catData = [...catCounts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return [
    { title: "Most requested medication categories", kind: "bar", data: catData },
    { title: "Volume by pharmacy branch", kind: "pie", data: countBy(requests, (r) => r.pharmacyBranch?.replace("Pharmacy Partner @ ", "") ?? "Unrouted") },
  ];
}

export function insights(org: OrgId, requests: HelpRequest[]): string[] {
  if (org === "AIC") {
    const repeats = repeatRecipientNames(requests);
    const out: string[] = [];
    if (repeats.size > 0) {
      // Areas where repeat households cluster.
      const repeatAreas = countBy(
        requests.filter((r) => repeats.has(r.recipient.name)),
        (r) => r.area
      );
      const topArea = repeatAreas[0];
      out.push(
        `${repeats.size} household${repeats.size === 1 ? "" : "s"} have submitted 2 or more requests recently — a signal for long-term care follow-up.`
      );
      if (topArea && topArea.value >= 2) {
        out.push(`${topArea.value} of these repeat requests are in ${topArea.label}, suggesting a localised care gap.`);
      }
    }
    const byType = countBy(requests, (r) => r.helpType);
    if (byType[0]) {
      out.push(`${byType[0].label} is the most common request type this period (${byType[0].value} requests), largely from elderly living alone.`);
    }
    const openReviews = requests.filter((r) => r.flaggedForCareReview && isOpen(r)).length;
    if (openReviews > 0) out.push(`${openReviews} case${openReviews === 1 ? "" : "s"} on the care-review watch list remain open.`);
    return out;
  }

  if (org === "SGCares") {
    const out: string[] = [];
    const unassigned = requests.filter((r) => isOpen(r) && (!r.assignedTeam || r.assignedOrganisation === "Unassigned"));
    if (unassigned.length > 0) {
      const areas = [...new Set(unassigned.map((r) => r.area))].join(", ");
      out.push(`${unassigned.length} open request${unassigned.length === 1 ? "" : "s"} not yet assigned to a volunteer (${areas}).`);
    }
    const openByArea = countBy(requests.filter(isOpen), (r) => r.area);
    if (openByArea[0]) out.push(`${openByArea[0].label} has the most open requests (${openByArea[0].value}) — volunteer coverage is stretched there.`);
    const langNeed = requests.filter((r) => isOpen(r) && r.riskFactors.includes("Language Support Needed")).length;
    if (langNeed > 0) out.push(`${langNeed} open case${langNeed === 1 ? "" : "s"} need dialect or language support — roster multilingual befrienders.`);
    return out;
  }

  // Pharmacy partner
  const out: string[] = [];
  const agedHighRisk = requests.filter(
    (r) => isOpen(r) && r.medications?.some((m) => m.highRisk) && hoursSince(r.submittedAt) > 24
  );
  if (agedHighRisk.length > 0) {
    const ids = agedHighRisk.map((r) => r.id).join(", ");
    out.push(`${agedHighRisk.length} high-risk medication request${agedHighRisk.length === 1 ? "" : "s"} unactioned for more than 24 hours (${ids}) — escalate for pharmacist sign-off.`);
  }
  const pending = requests.filter((r) => isOpen(r) && r.status !== "New").length;
  if (pending > 0) out.push(`${pending} request${pending === 1 ? "" : "s"} pending collection or delivery.`);
  const byBranch = countBy(requests, (r) => r.pharmacyBranch?.replace("Pharmacy Partner @ ", "") ?? "Unrouted");
  const busiest = byBranch.find((b) => b.label !== "Unrouted");
  if (busiest) out.push(`${busiest.label} branch is handling the most collections (${busiest.value}).`);
  return out;
}

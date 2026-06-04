import type { HelpRequest } from "./types";
import type { OrgId } from "./orgs";
import { areaMarkers } from "@/data/areaMarkers";
import { availableSlots, availableUnits, lowStockItems } from "@/data/agencyReadiness";

const CLOSED = new Set(["Fulfilled", "Unable To Fulfil", "Rerouted"]);

export function isOpen(r: HelpRequest): boolean {
  return !CLOSED.has(r.status);
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

function openRequests(requests: HelpRequest[]) {
  return requests.filter(isOpen);
}

function unassigned(requests: HelpRequest[]) {
  return requests.filter((r) => !r.assignedUnit || r.assignedOrganisation === "Unassigned");
}

export function statCards(org: OrgId, requests: HelpRequest[]): StatCard[] {
  const open = openRequests(requests);

  if (org === "AIC") {
    const flagged = requests.filter((r) => r.flaggedForCareReview);
    return [
      { label: "AAC units available", value: availableUnits("AIC"), accent: "green", hint: "emergency response" },
      { label: "Low-stock supplies", value: lowStockItems().length, accent: "amber", hint: "reorder watch" },
      { label: "Active care reviews", value: flagged.filter(isOpen).length, accent: "purple" },
      { label: "High priority", value: open.filter((r) => r.urgency === "High").length, accent: "red" },
    ];
  }

  if (org === "SGCares") {
    return [
      { label: "Active volunteers", value: availableSlots("SGCares"), accent: "blue", hint: "available now" },
      { label: "Unassigned cases", value: unassigned(open).length, accent: "amber", hint: "needs team" },
      { label: "Language support", value: open.filter((r) => r.riskFactors.includes("Language Support Needed")).length, accent: "purple" },
      { label: "Domain A cases", value: open.filter((r) => r.caseDomain === "A").length, accent: "red", hint: "psycho-social" },
    ];
  }

  if (org === "AACSGO") {
    return [
      { label: "Outreach slots", value: availableSlots("AACSGO"), accent: "purple", hint: "available now" },
      { label: "Living alone", value: open.filter((r) => r.riskFactors.includes("Living Alone")).length, accent: "amber" },
      { label: "Care navigation", value: open.filter((r) => r.helpType === "Care Referral / Navigation").length, accent: "blue" },
      { label: "Domain A cases", value: open.filter((r) => r.caseDomain === "A").length, accent: "red", hint: "isolation/caregiver" },
    ];
  }

  if (org === "SSOFSC") {
    return [
      { label: "Casework teams", value: availableUnits("SSOFSC"), accent: "green", hint: "available units" },
      { label: "Urgent basic needs", value: open.filter((r) => r.urgency === "High").length, accent: "red" },
      { label: "Food / vouchers", value: open.filter((r) => r.helpType === "Food & Meal Support").length, accent: "amber" },
      { label: "Unassigned cases", value: unassigned(open).length, accent: "purple" },
    ];
  }

  return [
    { label: "Care service cases", value: open.length, accent: "blue" },
    { label: "Meal support", value: open.filter((r) => r.helpType === "Food & Meal Support").length, accent: "green" },
    { label: "Clinic transport", value: open.filter((r) => r.helpType === "Clinic Transport Help").length, accent: "amber" },
    { label: "Care navigation", value: open.filter((r) => r.helpType === "Care Referral / Navigation").length, accent: "purple" },
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
      { title: "Volunteer demand by sector", kind: "bar", data: countBy(requests, (r) => regionOf(r.area)) },
      { title: "Volunteer request mix", kind: "pie", data: countBy(requests, (r) => r.helpType) },
    ];
  }

  if (org === "AACSGO") {
    return [
      { title: "Outreach demand by area", kind: "bar", data: countBy(requests, (r) => r.area).slice(0, 8) },
      { title: "Senior support mix", kind: "pie", data: countBy(requests, (r) => r.helpType) },
    ];
  }

  if (org === "SSOFSC") {
    return [
      { title: "Basic-needs demand by sector", kind: "bar", data: countBy(requests, (r) => regionOf(r.area)) },
      { title: "Social support mix", kind: "pie", data: countBy(requests, (r) => r.helpType) },
    ];
  }

  return [
    { title: "Care services by area", kind: "bar", data: countBy(requests, (r) => r.area).slice(0, 8) },
    { title: "AIC service mix", kind: "pie", data: countBy(requests, (r) => r.helpType) },
  ];
}

export function insights(org: OrgId, requests: HelpRequest[]): string[] {
  if (org === "AIC") {
    const repeats = repeatRecipientNames(requests);
    const out: string[] = [];
    if (repeats.size > 0) {
      out.push(
        `${repeats.size} household${repeats.size === 1 ? "" : "s"} have submitted 2 or more requests recently — a signal for care follow-up.`
      );
    }
    const byType = countBy(requests, (r) => r.helpType);
    if (byType[0]) out.push(`${byType[0].label} is the most common request type this period (${byType[0].value} requests).`);
    const openReviews = requests.filter((r) => r.flaggedForCareReview && isOpen(r)).length;
    if (openReviews > 0) out.push(`${openReviews} care-review watch-list case${openReviews === 1 ? "" : "s"} remain open.`);
    return out;
  }

  const out: string[] = [];
  const open = openRequests(requests);
  const noUnit = unassigned(open);
  if (noUnit.length > 0) {
    const areas = [...new Set(noUnit.map((r) => r.area))].join(", ");
    out.push(`${noUnit.length} open request${noUnit.length === 1 ? "" : "s"} need an assigned unit (${areas}).`);
  }
  const openByArea = countBy(open, (r) => r.area);
  if (openByArea[0]) out.push(`${openByArea[0].label} has the most open requests (${openByArea[0].value}).`);

  if (org === "SGCares") {
    const languageNeed = open.filter((r) => r.riskFactors.includes("Language Support Needed")).length;
    if (languageNeed > 0) out.push(`${languageNeed} case${languageNeed === 1 ? "" : "s"} need language support — roster multilingual volunteers.`);
  } else if (org === "AACSGO") {
    const alone = open.filter((r) => r.riskFactors.includes("Living Alone")).length;
    if (alone > 0) out.push(`${alone} open senior outreach case${alone === 1 ? "" : "s"} involve seniors living alone.`);
  } else if (org === "SSOFSC") {
    const basicNeeds = open.filter((r) => r.helpType === "Supplies & Networks" || r.helpType === "Food & Meal Support").length;
    if (basicNeeds > 0) out.push(`${basicNeeds} case${basicNeeds === 1 ? "" : "s"} involve immediate basic-needs support.`);
  } else {
    const transport = open.filter((r) => r.helpType === "Clinic Transport Help").length;
    if (transport > 0) out.push(`${transport} non-emergency clinic transport case${transport === 1 ? "" : "s"} need MET coordination.`);
  }

  return out;
}

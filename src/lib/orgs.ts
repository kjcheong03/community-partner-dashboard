import type { HelpRequest, HelpType } from "./types";

export type OrgId = "AIC" | "SGCares" | "Pharmacy";

export type OrgConfig = {
  id: OrgId;
  name: string;
  shortName: string;
  context: string;
  // "all" means a system-wide coordinator that sees every request.
  helpTypes: HelpType[] | "all";
};

export const ORGS: OrgConfig[] = [
  {
    id: "AIC",
    name: "Agency for Integrated Care",
    shortName: "AIC",
    context: "System Coordinator · Nationwide",
    helpTypes: "all",
  },
  {
    id: "SGCares",
    name: "SG Cares Volunteer Centre",
    shortName: "SG Cares",
    context: "Volunteer Operations · Central & East",
    helpTypes: ["Welfare Check", "Food & Essentials", "Masks & Hygiene", "Advisory Assistance"],
  },
  {
    id: "Pharmacy",
    name: "Pharmacy Partner Network",
    shortName: "Pharmacy Partner",
    context: "Medication Fulfilment · Islandwide",
    helpTypes: ["Medication Collection"],
  },
];

export function getOrg(id: OrgId): OrgConfig {
  return ORGS.find((o) => o.id === id) ?? ORGS[0];
}

export function requestsForOrg(requests: HelpRequest[], id: OrgId): HelpRequest[] {
  const org = getOrg(id);
  if (org.helpTypes === "all") return requests;
  const allowed = new Set(org.helpTypes);
  return requests.filter((r) => allowed.has(r.helpType));
}

// AIC can route any request to one of the onboarded partner organisations.
export const PARTNER_ORGS = [
  "SG Cares Volunteer Centre",
  "Silver Generation Office",
  "Pharmacy Partner Network",
  "Transport Partner Network",
  "Clinic Partner",
];

// SG Cares assigns ground work to its volunteer teams.
export const VOLUNTEER_TEAMS = [
  "Volunteer Team A",
  "Volunteer Team B",
  "Outreach Team",
  "Befriender Squad",
];

// Pharmacy partners route collection requests to a fulfilment branch.
export const PHARMACY_BRANCHES = [
  "Pharmacy Partner @ Tampines",
  "Pharmacy Partner @ Bedok",
  "Pharmacy Partner @ Ang Mo Kio",
  "Pharmacy Partner @ Jurong",
  "Pharmacy Partner @ Toa Payoh",
];

export const HIGH_RISK_NOTE =
  "High-risk medication — verify identity, check interactions, and require pharmacist sign-off before release.";

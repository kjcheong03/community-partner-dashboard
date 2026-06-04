import type { HelpRequest, HelpType } from "./types";

export type OrgId = "AIC" | "SGCares" | "AACSGO" | "SSOFSC" | "AICCare";

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
    context: "Volunteer Coordination · Town-based",
    helpTypes: ["Supplies & Networks", "Food & Meal Support", "Welfare Check"],
  },
  {
    id: "AACSGO",
    name: "AAC/SGO Outreach",
    shortName: "AAC/SGO",
    context: "Senior Outreach · Befriending & referrals",
    helpTypes: ["Welfare Check", "Care Referral / Navigation"],
  },
  {
    id: "SSOFSC",
    name: "SSO/FSC Support",
    shortName: "SSO/FSC",
    context: "Social Support · Basic needs",
    helpTypes: ["Supplies & Networks", "Food & Meal Support", "Care Referral / Navigation"],
  },
  {
    id: "AICCare",
    name: "AIC Care Services",
    shortName: "AIC Care",
    context: "Meals, MET & care navigation",
    helpTypes: ["Food & Meal Support", "Clinic Transport Help", "Care Referral / Navigation"],
  },
];

export function getOrg(id: OrgId): OrgConfig {
  return ORGS.find((o) => o.id === id) ?? ORGS[0];
}

export function requestsForOrg(requests: HelpRequest[], id: OrgId): HelpRequest[] {
  const org = getOrg(id);
  if (org.helpTypes === "all") return requests;
  const allowed = new Set(org.helpTypes);
  return requests.filter(
    (r) => allowed.has(r.helpType) && (r.assignedOrganisation === org.name || r.assignedOrganisation === "Unassigned")
  );
}

// AIC can route any request to one of the onboarded partner organisations.
export const PARTNER_ORGS = [
  "SG Cares Volunteer Centre",
  "AAC/SGO Outreach",
  "SSO/FSC Support",
  "AIC Care Services",
];

export const TEAM_OPTIONS: Record<OrgId, string[]> = {
  AIC: [],
  SGCares: ["Volunteer Team A", "Volunteer Team B", "Outreach Team", "Befriender Squad"],
  AACSGO: ["SGA Outreach Team", "AAC Befriender Team", "Senior Referral Desk", "Emergency Alert Follow-up"],
  SSOFSC: ["SSO Intake Desk", "FSC Casework Team", "ComCare Support Desk", "Community Partner Liaison"],
  AICCare: ["Meals on Wheels Desk", "MET Coordination Desk", "Care Navigation Desk", "AIC Link Advisor"],
};

export function teamsForOrg(org: OrgId): string[] {
  return TEAM_OPTIONS[org];
}

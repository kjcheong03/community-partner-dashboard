import type { OrgId } from "@/lib/orgs";
import { areaMarkers } from "./areaMarkers";

export type FacilityType = "hub" | "office" | "outreach" | "support" | "care" | "clinic";

export type Facility = {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lng: number;
  region: string;
  info: string;
  hours: string;
};

// AIC coordination hubs (shown for the AIC system-coordinator view).
const AIC_HUBS: Facility[] = [
  { id: "AIC-HQ", name: "AIC HQ (Maxwell)", type: "hub", lat: 1.28, lng: 103.844, region: "Central", info: "Central coordination & partner routing desk.", hours: "Mon–Fri 8.30am–6pm" },
  { id: "AIC-TPE", name: "AIC Link @ Tampines", type: "hub", lat: 1.353, lng: 103.945, region: "East", info: "East-zone partner liaison & escalation hub.", hours: "Mon–Sat 9am–5pm" },
  { id: "AIC-JUR", name: "AIC Link @ Jurong", type: "hub", lat: 1.333, lng: 103.742, region: "West", info: "West-zone partner liaison & escalation hub.", hours: "Mon–Sat 9am–5pm" },
];

// SG Cares Volunteer Centres (shown for the SG Cares view).
const SGCARES_OFFICES: Facility[] = [
  { id: "VC-BDK", name: "SG Cares VC @ Bedok", type: "office", lat: 1.324, lng: 103.93, region: "East", info: "Befriender & welfare-check dispatch. ~28 active volunteers today.", hours: "Daily 8am–8pm" },
  { id: "VC-TPE", name: "SG Cares VC @ Tampines", type: "office", lat: 1.354, lng: 103.943, region: "East", info: "Food & essentials hub. Holds emergency grocery packs.", hours: "Daily 8am–8pm" },
  { id: "VC-AMK", name: "SG Cares VC @ Ang Mo Kio", type: "office", lat: 1.369, lng: 103.846, region: "Central", info: "Central-zone volunteer base. Multilingual befrienders on roster.", hours: "Daily 8am–8pm" },
  { id: "VC-TPY", name: "SG Cares VC @ Toa Payoh", type: "office", lat: 1.334, lng: 103.849, region: "Central", info: "Advisory-assistance & translation support team.", hours: "Mon–Sat 9am–6pm" },
];

// AAC / Silver Generation Office outreach points for senior welfare follow-ups.
const AAC_SGO_OUTREACH: Facility[] = [
  { id: "AAC-BDK", name: "AAC/SGO Outreach @ Bedok", type: "outreach", lat: 1.324, lng: 103.93, region: "East", info: "Befriending, senior outreach, and care-referral follow-up.", hours: "Mon–Sat 9am–6pm" },
  { id: "AAC-TPE", name: "AAC/SGO Outreach @ Tampines", type: "outreach", lat: 1.354, lng: 103.943, region: "East", info: "Senior check-ins and emergency alert follow-up.", hours: "Mon–Sat 9am–6pm" },
  { id: "AAC-AMK", name: "AAC/SGO Outreach @ Ang Mo Kio", type: "outreach", lat: 1.369, lng: 103.846, region: "Central", info: "Silver Generation Ambassador dispatch and AAC referrals.", hours: "Mon–Sat 9am–6pm" },
  { id: "AAC-TPY", name: "AAC/SGO Outreach @ Toa Payoh", type: "outreach", lat: 1.334, lng: 103.849, region: "Central", info: "Befriending team with language-support roster.", hours: "Mon–Sat 9am–6pm" },
  { id: "AAC-YIS", name: "AAC/SGO Outreach @ Yishun", type: "outreach", lat: 1.428, lng: 103.84, region: "North-East", info: "North-zone outreach and care-navigation follow-up.", hours: "Mon–Sat 9am–6pm" },
];

// Social Service Office / Family Service Centre support touchpoints.
const SSO_FSC_SUPPORT: Facility[] = [
  { id: "SSO-BDK", name: "SSO/FSC Support @ Bedok", type: "support", lat: 1.325, lng: 103.93, region: "East", info: "Urgent basic-needs triage, food rations, and voucher support.", hours: "Mon–Fri 9am–6pm" },
  { id: "SSO-AMK", name: "SSO/FSC Support @ Ang Mo Kio", type: "support", lat: 1.37, lng: 103.846, region: "Central", info: "ComCare intake and FSC casework referral.", hours: "Mon–Fri 9am–6pm" },
  { id: "SSO-JUR", name: "SSO/FSC Support @ Jurong", type: "support", lat: 1.333, lng: 103.742, region: "West", info: "Social support desk for lower-income households.", hours: "Mon–Fri 9am–6pm" },
  { id: "SSO-TPY", name: "SSO/FSC Support @ Toa Payoh", type: "support", lat: 1.334, lng: 103.849, region: "Central", info: "Family casework and community partner liaison.", hours: "Mon–Fri 9am–6pm" },
];

// AIC Care Services touchpoints for Meals on Wheels, MET, and care navigation.
const AIC_CARE_SERVICES: Facility[] = [
  { id: "CARE-MAX", name: "AIC Care Services @ Maxwell", type: "care", lat: 1.28, lng: 103.844, region: "Central", info: "AIC Link advice, care-navigation, MOW, and MET triage.", hours: "Mon–Fri 8.30am–8.30pm" },
  { id: "CARE-TPE", name: "AIC Care Services @ Tampines", type: "care", lat: 1.353, lng: 103.945, region: "East", info: "East-zone Meals on Wheels and care-services coordination.", hours: "Mon–Sat 9am–5pm" },
  { id: "CARE-JUR", name: "AIC Care Services @ Jurong", type: "care", lat: 1.333, lng: 103.742, region: "West", info: "West-zone MET and care-services coordination.", hours: "Mon–Sat 9am–5pm" },
  { id: "CARE-AMK", name: "AIC Care Services @ Ang Mo Kio", type: "care", lat: 1.369, lng: 103.846, region: "Central", info: "Care navigation and appointment transport coordination.", hours: "Mon–Sat 9am–5pm" },
];

// Polyclinics & hospitals relevant to every org (referral / escalation points).
const CLINICS: Facility[] = [
  { id: "CL-TPE", name: "Tampines Polyclinic", type: "clinic", lat: 1.354, lng: 103.944, region: "East", info: "Walk-in & chronic care. Accepts CARA welfare referrals.", hours: "Mon–Sun 8am–4.30pm" },
  { id: "CL-BDK", name: "Bedok Polyclinic", type: "clinic", lat: 1.327, lng: 103.918, region: "East", info: "Acute fever screening active during dengue advisory.", hours: "Mon–Sun 8am–4.30pm" },
  { id: "CL-AMK", name: "Ang Mo Kio Polyclinic", type: "clinic", lat: 1.374, lng: 103.845, region: "Central", info: "Geriatric clinic on-site. Wheelchair accessible.", hours: "Mon–Sat 8am–4.30pm" },
  { id: "CL-NTFH", name: "Ng Teng Fong General Hospital", type: "clinic", lat: 1.334, lng: 103.745, region: "West", info: "A&E + specialist clinics. Nearest hospital for west zone.", hours: "24 hours (A&E)" },
  { id: "CL-SGH", name: "Singapore General Hospital", type: "clinic", lat: 1.279, lng: 103.835, region: "Central", info: "A&E + specialist clinics. Nearest hospital for central zone.", hours: "24 hours (A&E)" },
  { id: "CL-YSH", name: "Yishun Polyclinic", type: "clinic", lat: 1.428, lng: 103.84, region: "North", info: "Fever screening active. Accepts CARA welfare referrals.", hours: "Mon–Sun 8am–4.30pm" },
  { id: "CL-GEY", name: "Geylang Polyclinic", type: "clinic", lat: 1.314, lng: 103.887, region: "East", info: "Dengue cluster zone — extended fever screening hours.", hours: "Mon–Sun 8am–6pm" },
];

const OWN_FACILITIES: Record<OrgId, Facility[]> = {
  AIC: AIC_HUBS,
  SGCares: SGCARES_OFFICES,
  AACSGO: AAC_SGO_OUTREACH,
  SSOFSC: SSO_FSC_SUPPORT,
  AICCare: AIC_CARE_SERVICES,
};

export function ownFacilities(org: OrgId): Facility[] {
  return OWN_FACILITIES[org];
}

export function clinics(): Facility[] {
  return CLINICS;
}

// Own facilities (offices/branches/hubs) plus nearby clinics for context.
export function facilitiesForOrg(org: OrgId): Facility[] {
  return [...OWN_FACILITIES[org], ...CLINICS];
}

export const FACILITY_LABEL: Record<FacilityType, string> = {
  hub: "AIC Hub",
  office: "Volunteer Centre",
  outreach: "AAC/SGO Outreach",
  support: "SSO/FSC Support",
  care: "AIC Care Services",
  clinic: "Clinic / Hospital",
};

// Label for an org's own facility type (used in "nearest ___" context).
export function ownFacilityLabel(org: OrgId): string {
  if (org === "AIC") return "AIC hub";
  if (org === "SGCares") return "volunteer centre";
  if (org === "AACSGO") return "AAC/SGO outreach point";
  if (org === "SSOFSC") return "SSO/FSC support point";
  return "AIC care services point";
}

export function areaLatLng(area: string): { lat: number; lng: number } | null {
  const m = areaMarkers.find((a) => a.name === area);
  return m ? { lat: m.lat, lng: m.lng } : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export function nearestFacility(
  area: string,
  list: Facility[]
): { facility: Facility; km: number } | null {
  const coords = areaLatLng(area);
  if (!coords || list.length === 0) return null;
  let best: { facility: Facility; km: number } | null = null;
  for (const f of list) {
    const km = haversineKm(coords.lat, coords.lng, f.lat, f.lng);
    if (!best || km < best.km) best = { facility: f, km };
  }
  return best;
}

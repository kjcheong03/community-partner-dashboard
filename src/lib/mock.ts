// ---------------------------------------------------------------------------
// Mock RequestSession[] for the kit preview/dashboard. Frontend-only.
//
// Emits exactly what the ORCA producer would persist on submit (the canonical
// contract shape), with real form field keys, routed to the real ORCA org ids
// so flattenToWorkItems() scopes correctly. Deterministic — fixed ids/times.
// ---------------------------------------------------------------------------

import type {
  CostEstimate,
  FulfilmentRoute,
  RequestSession,
  RequestStatus,
  RequestTaskSession,
  SupportTypeId,
  WorkItem,
} from "./contract";

// --- minimal org directory (display only; real org logic is deferred) ------

export type OrgInfo = { id: string; name: string; shortName: string; logo?: string; area: string };

export const ORG_DIRECTORY: Record<string, OrgInfo> = {
  "allkin-aac-amk": { id: "allkin-aac-amk", name: "Allkin Singapore — Active Ageing", shortName: "Allkin AAC", logo: "/logos/allkin.png", area: "Ang Mo Kio" },
  "care-corner-aac-toa-payoh": { id: "care-corner-aac-toa-payoh", name: "Care Corner Active Ageing Centre", shortName: "Care Corner AAC", logo: "/logos/care-corner.png", area: "Toa Payoh" },
  "st-lukes-aac-bishan": { id: "st-lukes-aac-bishan", name: "St Luke's Active Ageing Centre", shortName: "St Luke's AAC", area: "Bishan" },
  "aic-link": { id: "aic-link", name: "AIC Link", shortName: "AIC Link", area: "Nationwide" },
  "touch-meals-on-wheels": { id: "touch-meals-on-wheels", name: "TOUCH Meals on Wheels", shortName: "TOUCH MOW", logo: "/logos/touch.png", area: "Central" },
  "food-from-the-heart": { id: "food-from-the-heart", name: "Food from the Heart", shortName: "FFTH", logo: "/logos/ffth.png", area: "Central" },
  "touch-medical-escort-transport": { id: "touch-medical-escort-transport", name: "TOUCH Medical Escort & Transport", shortName: "TOUCH MET", area: "Central" },
};

export function orgInfo(id: string | null | undefined): OrgInfo | undefined {
  return id ? ORG_DIRECTORY[id] : undefined;
}
export function orgName(id: string | null | undefined): string {
  return orgInfo(id)?.shortName ?? "—";
}

// --- cost builders ---------------------------------------------------------

const free: CostEstimate = {
  costType: "free",
  total: 0,
  currency: "SGD",
  partnerConfirms: false,
  breakdown: [{ label: "Service", quantity: 1, unitPrice: 0, subtotal: 0, costType: "free" }],
};

const transportEstimate: CostEstimate = {
  costType: "estimated",
  min: 18,
  max: 30,
  currency: "SGD",
  partnerConfirms: true,
  detail: "Estimated return trip; partner confirms",
  breakdown: [{ label: "Assisted transport (return)", quantity: 1, min: 18, max: 30, costType: "estimated" }],
};

// --- task builders ---------------------------------------------------------

function partnerTask(
  supportType: SupportTypeId,
  subtypes: string[],
  primary: string,
  fallbacks: string[],
  status: RequestStatus,
  details: Record<string, unknown>,
  cost: CostEstimate = free,
  extra: Partial<RequestTaskSession> = {}
): RequestTaskSession {
  return {
    id: supportType,
    fulfilment: "partner",
    supportType,
    selectedSubtypes: subtypes,
    details,
    primaryOrganisationId: primary,
    fallbackOrganisationIds: fallbacks,
    costEstimate: cost,
    status,
    ...extra,
  };
}

function foodRoute(label: string, orgId: string, routeName: string, logo: string, lifecycle?: RequestStatus): FulfilmentRoute {
  return {
    label,
    quantity: 1,
    routeName,
    logo,
    organisationId: orgId,
    routeType: "partner_service",
    availabilityMode: "partner_assessment",
    costLabel: label === "Cooked meals" ? "$4.90–$7.00 / meal" : "Free / partner assessment",
    status: "Partner will confirm availability",
    lifecycle,
  };
}

function foodTask(subtypes: string[], routes: FulfilmentRoute[], details: Record<string, unknown>): RequestTaskSession {
  return {
    id: "food",
    fulfilment: "route",
    supportType: "food",
    selectedSubtypes: subtypes,
    details,
    primaryOrganisationId: "",
    fallbackOrganisationIds: [],
    fulfilmentRoutes: routes,
    status: "Pending",
  };
}

function suppliesTask(items: { item: string; quantity: number }[], status: RequestStatus): RequestTaskSession {
  const routes: FulfilmentRoute[] = items.map((it) => ({
    label: it.item,
    quantity: it.quantity,
    workspaceId: supplyWorkspaceId(it.item),
    routeName:
      it.item === "ART kits"
        ? "Ministry of Health — ART kit distribution"
        : it.item === "Dengue kit / repellent pack"
          ? "NEA dengue outreach / local community stock"
          : "Temasek Foundation distribution exercise",
    logo: it.item === "ART kits" ? "/logos/moh.png" : it.item === "Dengue kit / repellent pack" ? "/logos/nea.png" : "/logos/temasek.png",
    routeType: it.item === "Dengue kit / repellent pack" ? "community_distribution" : "public_distribution",
    availabilityMode: it.item === "Dengue kit / repellent pack" ? "local_stock_subject_to_availability" : "active_distribution_exercise",
    costLabel: "Free",
    status: "Available while stock lasts",
    lifecycle: status,
  }));
  return {
    id: "supplies",
    fulfilment: "route",
    supportType: "supplies",
    selectedSubtypes: items.map((i) => i.item),
    details: {
      itemsNeeded: items.map((i) => ({ item: i.item, quantity: String(i.quantity) })),
      neededBy: "Today",
      suppliesFulfilment: "Collect from distribution point",
      preferredCollectionArea: "Ang Mo Kio",
    },
    primaryOrganisationId: "",
    fallbackOrganisationIds: [],
    fulfilmentRoutes: routes,
    status,
  };
}

function supplyWorkspaceId(item: string): string {
  if (item === "ART kits") return "moh-art-kit-distribution";
  if (item === "Dengue kit / repellent pack") return "nea-dengue-outreach";
  return "temasek-distribution";
}

// --- detail presets (real form field keys) ---------------------------------

const welfareDetails = (method: string, when: string): Record<string, unknown> => ({
  checkMethod: method,
  checkInDay: when,
  preferredTime: "Morning",
  language: "Mandarin",
  safetyNotes: "Lives alone; neighbour has a spare key.",
  notes: "Caregiver travelling for two days and cannot check in.",
});

const referralDetails = (when: string): Record<string, unknown> => ({
  mainConcern: "Looking for a suitable day-care / eldercare arrangement nearby.",
  currentSituation: "Currently managed at home but caregiver load is rising.",
  urgency: when,
  language: "English",
  existingSupport: "Already seeing a polyclinic GP.",
});

const transportDetails = (): Record<string, unknown> => ({
  destination: "AMK Polyclinic",
  appointmentDateTime: "2026-06-06T09:30",
  pickupArea: "Ang Mo Kio",
  wheelchairRequired: true,
  escortNeeded: true,
  returnTripNeeded: true,
  mobilityNeeds: "Uses a walking frame; needs help to the lift.",
});

// --- session builder -------------------------------------------------------

// Chronological createdAt: each successive session is ~18 min later, so request
// IDs run in time order (req-001 = earliest). Spread fits within 5 Jun daytime
// (SGT), so "Today" needed-by resolves to 5 Jun for every row.
const BASE_MS = Date.UTC(2026, 5, 5, 0, 30, 0); // 8:30am SGT, 5 Jun

let seq = 0;
function session(
  caregiverName: string,
  relationship: string,
  careRecipientName: string,
  area: string,
  topic: string,
  tasks: RequestTaskSession[],
  fields: Partial<RequestSession> = {}
): RequestSession {
  seq += 1;
  const id = `req-${String(seq).padStart(3, "0")}`;
  return {
    id,
    careRecipientName,
    caregiverName,
    contactNumber: "+65 8" + String(100 + seq).slice(-3) + " " + String(4000 + seq * 7).slice(-4),
    contactMethod: seq % 2 ? "WhatsApp" : "Phone call",
    relationship,
    generalArea: area,
    address: `Blk ${100 + seq} ${area}, #0${(seq % 9) + 1}-${10 + seq}`,
    linkedTopic: topic,
    createdAt: new Date(BASE_MS + seq * 18 * 60_000).toISOString(),
    overallStatus: tasks.length ? tasks[0].status : "Pending",
    tasks,
    ...fields,
  };
}

// --- the dataset -----------------------------------------------------------

// Compact partner-task entry: one welfare/referral request → one session.
type Entry = {
  cg: string; rel: string; cr: string; area: string; topic: string;
  org: string; type: "welfare" | "referral"; sub: string;
  status: RequestStatus; when: string; method?: string; reason?: string;
};

const ALLKIN: Entry[] = [
  { cg: "Chloe Tan", rel: "Daughter", cr: "Madam Tan", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Caregiver cannot check in", status: "Pending", when: "Today", method: "Phone call" },
  { cg: "Daniel Lim", rel: "Son", cr: "Mr Lim", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Pending", when: "Today", method: "Home visit" },
  { cg: "Marcus Goh", rel: "Son", cr: "Mr Goh", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "General wellbeing check", status: "Pending", when: "Tomorrow", method: "Phone call" },
  { cg: "Wei Jie Ong", rel: "Grandson", cr: "Madam Ong", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Concern about daily needs", status: "Pending", when: "Within 2–3 days", method: "Either is okay" },
  { cg: "Sarah Teo", rel: "Daughter", cr: "Mr Teo", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Caregiver cannot check in", status: "Pending", when: "Today", method: "Phone call" },
  { cg: "Priya Kumar", rel: "Neighbour", cr: "Madam Sundari", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "referral", sub: "Find suitable eldercare service", status: "Pending", when: "This week" },
  { cg: "Hafiz Rahman", rel: "Son", cr: "Mr Rahman", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "referral", sub: "Connect to local AAC", status: "Pending", when: "Within 2–3 days" },
  { cg: "Daniel Lim", rel: "Son", cr: "Mr Lim", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Accepted", when: "Tomorrow", method: "Home visit" },
  { cg: "Hannah Wee", rel: "Daughter", cr: "Madam Wee", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "General wellbeing check", status: "Accepted", when: "Today", method: "Phone call" },
  { cg: "Ben Sng", rel: "Son", cr: "Mr Sng", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "referral", sub: "Longer-term home care help", status: "Accepted", when: "This week" },
  { cg: "Mei Ling Koh", rel: "Daughter", cr: "Madam Koh", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Concern about daily needs", status: "In progress", when: "Today", method: "Home visit" },
  { cg: "Wei Jie Ong", rel: "Grandson", cr: "Madam Ong", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "referral", sub: "Find suitable eldercare service", status: "In progress", when: "Within 2–3 days" },
  { cg: "Hannah Wee", rel: "Daughter", cr: "Madam Wee", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Caregiver cannot check in", status: "Completed", when: "Today", method: "Home visit" },
  { cg: "Joseph Lai", rel: "Son", cr: "Mr Lai", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Completed", when: "Today", method: "Phone call" },
  { cg: "Ramesh Pillai", rel: "Son", cr: "Mr Pillai", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "referral", sub: "Apply for support / subsidies", status: "Rejected", when: "This week", reason: "Outside catchment — rerouted to SSO/FSC." },
  { cg: "Adeline Foo", rel: "Daughter", cr: "Madam Foo", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "General wellbeing check", status: "Pending", when: "Today", method: "Phone call" },
  { cg: "Jeremy Ng", rel: "Son", cr: "Mr Ng", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Pending", when: "Tomorrow", method: "Home visit" },
  { cg: "Lina Goh", rel: "Daughter", cr: "Madam Goh", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Caregiver cannot check in", status: "Pending", when: "Today", method: "Phone call" },
  { cg: "Suresh Nair", rel: "Son", cr: "Mr Nair", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "referral", sub: "Connect to local AAC", status: "Pending", when: "This week" },
  { cg: "Cheryl Lim", rel: "Granddaughter", cr: "Madam Heng", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Concern about daily needs", status: "Pending", when: "Within 2–3 days", method: "Either is okay" },
  { cg: "Arjun Das", rel: "Son", cr: "Mr Das", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Pending", when: "Today", method: "Home visit" },
  { cg: "Pauline Yeo", rel: "Daughter", cr: "Madam Yeo", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "referral", sub: "Longer-term home care help", status: "Accepted", when: "This week" },
  { cg: "Gerald Tan", rel: "Son", cr: "Mr Tan", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "General wellbeing check", status: "Accepted", when: "Tomorrow", method: "Phone call" },
  { cg: "Farah Ismail", rel: "Daughter", cr: "Madam Ismail", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Caregiver cannot check in", status: "In progress", when: "Today", method: "Home visit" },
  { cg: "Victor Loh", rel: "Son", cr: "Mr Loh", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "welfare", sub: "Concern about daily needs", status: "Pending", when: "Within 2–3 days", method: "Phone call" },
  { cg: "Denise Chua", rel: "Daughter", cr: "Madam Chua", area: "Ang Mo Kio", topic: "COVID-19", org: "allkin-aac-amk", type: "referral", sub: "Find suitable eldercare service", status: "Pending", when: "This week" },
  { cg: "Samuel Ang", rel: "Son", cr: "Mr Ang", area: "Ang Mo Kio", topic: "Dengue alert", org: "allkin-aac-amk", type: "welfare", sub: "Follow-up after symptoms", status: "Completed", when: "Today", method: "Phone call" },
];

const OTHER_AAC: Entry[] = [
  { cg: "Nurul Aisyah", rel: "Daughter", cr: "Madam Rahimah", area: "Toa Payoh", topic: "COVID-19", org: "care-corner-aac-toa-payoh", type: "welfare", sub: "Caregiver cannot check in", status: "Pending", when: "Today", method: "Phone call" },
  { cg: "Kelvin Tay", rel: "Son", cr: "Mr Tay", area: "Toa Payoh", topic: "Dengue alert", org: "care-corner-aac-toa-payoh", type: "welfare", sub: "General wellbeing check", status: "Accepted", when: "Tomorrow", method: "Home visit" },
  { cg: "Joseph Chan", rel: "Son", cr: "Mr Chan", area: "Bishan", topic: "Dengue alert", org: "st-lukes-aac-bishan", type: "welfare", sub: "Follow-up after symptoms", status: "Pending", when: "Tomorrow", method: "Phone call" },
];

// Cross-area requests for the nationwide/admin map view. Routed to aic-link
// (not in the partner demo switcher) so they enrich the choropleth + click-through
// without cluttering the six partner queues.
const NATIONWIDE: Entry[] = [
  { cg: "Eunice Tan", rel: "Daughter", cr: "Madam Lee", area: "Bedok", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Find suitable eldercare service", status: "Pending", when: "This week" },
  { cg: "Raj Singh", rel: "Son", cr: "Mr Raj", area: "Bedok", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Longer-term home care help", status: "Pending", when: "This week" },
  { cg: "Michelle Ho", rel: "Daughter", cr: "Madam Ho", area: "Bedok", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Apply for support / subsidies", status: "Accepted", when: "Within 2–3 days" },
  { cg: "Daryl Ong", rel: "Son", cr: "Mr Ong", area: "Tampines", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Find suitable eldercare service", status: "Pending", when: "This week" },
  { cg: "Aishah Latif", rel: "Daughter", cr: "Madam Latif", area: "Tampines", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Connect to local AAC", status: "In progress", when: "This week" },
  { cg: "Wendy Soh", rel: "Daughter", cr: "Madam Soh", area: "Yishun", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Longer-term home care help", status: "Pending", when: "This week" },
  { cg: "Kumar Raja", rel: "Son", cr: "Mr Raja", area: "Yishun", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Connect to local AAC", status: "Accepted", when: "Within 2–3 days" },
  { cg: "Joanne Lim", rel: "Daughter", cr: "Madam Lim", area: "Hougang", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Apply for support / subsidies", status: "Pending", when: "Within 2–3 days" },
  { cg: "Faizal Noor", rel: "Son", cr: "Mr Noor", area: "Geylang", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Find suitable eldercare service", status: "Pending", when: "This week" },
  { cg: "Tracy Wong", rel: "Daughter", cr: "Madam Wong", area: "Queenstown", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Longer-term home care help", status: "Completed", when: "This week" },
  { cg: "Hassan Ali", rel: "Son", cr: "Mr Ali", area: "Jurong West", topic: "Dengue alert", org: "aic-link", type: "referral", sub: "Longer-term home care help", status: "Pending", when: "This week" },
  { cg: "Grace Tan", rel: "Daughter", cr: "Madam Goh", area: "Woodlands", topic: "COVID-19", org: "aic-link", type: "referral", sub: "Connect to local AAC", status: "Pending", when: "Within 2–3 days" },
];

function entrySession(e: Entry): RequestSession {
  const details = e.type === "welfare" ? welfareDetails(e.method ?? "Phone call", e.when) : referralDetails(e.when);
  const task = partnerTask(e.type, [e.sub], e.org, [], e.status, details, free, e.reason ? { rejectionReason: e.reason } : {});
  return session(e.cg, e.rel, e.cr, e.area, e.topic, [task]);
}

export function generateSessions(): RequestSession[] {
  seq = 0;
  const out: RequestSession[] = [];

  [...ALLKIN, ...OTHER_AAC, ...NATIONWIDE].forEach((e) => out.push(entrySession(e)));

  // Food — fans out to two orgs (MOW + FFTH), each owns its route.
  out.push(
    session("Aishah Bte Omar", "Daughter", "Madam Devi", "Ang Mo Kio", "COVID-19", [
      foodTask(
        ["Cooked meals", "Food pack / rations"],
        [
          foodRoute("Cooked meals", "touch-meals-on-wheels", "TOUCH Meals on Wheels", "/logos/touch.png", "Accepted"),
          foodRoute("Food pack / rations", "food-from-the-heart", "Food from the Heart", "/logos/ffth.png", "Pending"),
        ],
        { portionsPerMeal: 2, mealsNeeded: ["Lunch", "Dinner"], startDate: "Today", duration: "2–3 days", dietaryRestrictions: ["Low salt"], preferredDeliveryTime: "Before 12pm", packType: "Standard food pack / rations", numberOfPacks: "1 pack", neededBy: "Today", fulfilmentMethod: "Doorstep delivery" }
      ),
    ])
  );
  out.push(
    session("Faizal Rahman", "Son", "Mr Pereira", "Toa Payoh", "COVID-19", [
      foodTask(
        ["Cooked meals"],
        [foodRoute("Cooked meals", "touch-meals-on-wheels", "TOUCH Meals on Wheels", "/logos/touch.png", "In progress")],
        { portionsPerMeal: 1, mealsNeeded: ["Dinner"], startDate: "Tomorrow", duration: "This week", preferredDeliveryTime: "Evening" }
      ),
    ])
  );

  // Transport — partner-assigned, wheelchair requirement, real estimate.
  out.push(
    session("Grace Sim", "Daughter", "Madam Sim", "Ang Mo Kio", "COVID-19", [
      partnerTask("transport", ["Medical appointment transport"], "touch-medical-escort-transport", [], "Accepted", transportDetails(), transportEstimate),
    ])
  );
  out.push(
    session("Liang Wei", "Son", "Mr Quek", "Toa Payoh", "Dengue alert", [
      partnerTask(
        "transport",
        ["Medical appointment transport"],
        "touch-medical-escort-transport",
        [],
        "Pending",
        { destination: "Tan Tock Seng Hospital", appointmentDateTime: "2026-06-07T14:00", pickupArea: "Toa Payoh", wheelchairRequired: false, escortNeeded: true, returnTripNeeded: false },
        free
      ),
    ])
  );

  // Supplies — public distribution, no partner actor (admin/unscoped view only).
  out.push(
    session("Yusof Ibrahim", "Son", "Mr Yusof", "Ang Mo Kio", "Dengue alert", [
      suppliesTask([{ item: "Masks", quantity: 1 }, { item: "ART kits", quantity: 4 }], "Pending"),
    ])
  );
  out.push(
    session("Nadia Lim", "Daughter", "Madam Liew", "Bedok", "Dengue alert", [
      suppliesTask([{ item: "Hand sanitiser", quantity: 3 }, { item: "Dengue kit / repellent pack", quantity: 2 }], "Pending"),
    ])
  );
  out.push(
    session("Ong Kai", "Son", "Mr Ong", "Tampines", "COVID-19", [
      suppliesTask([{ item: "Masks", quantity: 2 }, { item: "ART kits", quantity: 2 }, { item: "Dengue kit / repellent pack", quantity: 1 }], "Completed"),
    ])
  );
  out.push(
    session("Sara Yeo", "Daughter", "Madam Yeo", "Yishun", "COVID-19", [
      suppliesTask([{ item: "Hand sanitiser", quantity: 1 }], "Cancelled"),
    ])
  );

  return out;
}

// --- data helpers (operate on the WorkItem stream) -------------------------

export function statusCounts(items: WorkItem[]): Record<RequestStatus, number> {
  const base: Record<RequestStatus, number> = {
    Pending: 0, Accepted: 0, "In progress": 0, Completed: 0, Rejected: 0, Cancelled: 0,
  };
  for (const it of items) base[it.status] += 1;
  return base;
}

const OPEN: RequestStatus[] = ["Pending", "Accepted", "In progress"];
export function isOpenStatus(s: RequestStatus): boolean {
  return OPEN.includes(s);
}

export function countByArea(items: WorkItem[]): { area: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const a = it.session.generalArea ?? "Unknown";
    m.set(a, (m.get(a) ?? 0) + 1);
  }
  return [...m.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
}

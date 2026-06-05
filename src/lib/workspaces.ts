export type WidgetId = "queue" | "analytics" | "map" | "schedule" | "inventory";
export type WorkspaceProfile = "schedule-ops" | "inventory-ops" | "triage-ops";
export type InventoryKind = "cooked-meals" | "food-packs" | "public-supplies";
export type ScheduleKind = "outreach" | "transport";
export type SupportGroup = "welfare" | "referral" | "food" | "transport" | "supplies";

export type WorkspaceConfig = {
  id: string;
  slug: string;
  accountId: string;
  name: string;
  shortName: string;
  logo?: string;
  supportGroup: SupportGroup;
  profile: WorkspaceProfile;
  widgets: WidgetId[];
  supplyRouteLabels?: string[];
  scheduleKind?: ScheduleKind;
  inventoryKind?: InventoryKind;
};

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: "allkin-aac-amk",
    slug: "allkin-aac-amk",
    accountId: "allkin",
    name: "Allkin Singapore",
    shortName: "Allkin AAC",
    logo: "/logos/allkin.png",
    supportGroup: "welfare",
    profile: "schedule-ops",
    widgets: ["queue", "analytics", "map", "schedule"],
    scheduleKind: "outreach",
  },
  {
    id: "care-corner-aac-toa-payoh",
    slug: "care-corner-aac-toa-payoh",
    accountId: "care-corner",
    name: "Care Corner",
    shortName: "Care Corner AAC",
    logo: "/logos/care-corner.png",
    supportGroup: "welfare",
    profile: "schedule-ops",
    widgets: ["queue", "analytics", "map", "schedule"],
    scheduleKind: "outreach",
  },
  {
    id: "st-lukes-aac-bishan",
    slug: "st-lukes-aac-bishan",
    accountId: "st-lukes",
    name: "St Luke's ElderCare",
    shortName: "St Luke's AAC",
    logo: "/logos/st-lukes.png",
    supportGroup: "welfare",
    profile: "schedule-ops",
    widgets: ["queue", "analytics", "map", "schedule"],
    scheduleKind: "outreach",
  },
  {
    id: "aic-link",
    slug: "aic-link",
    accountId: "aic",
    name: "AIC Link",
    shortName: "AIC Link",
    logo: "/logos/aic.png",
    supportGroup: "referral",
    profile: "triage-ops",
    widgets: ["queue", "analytics", "map"],
  },
  {
    id: "touch-meals-on-wheels",
    slug: "touch-meals-on-wheels",
    accountId: "touch",
    name: "TOUCH Meals-on-Wheels",
    shortName: "TOUCH MOW",
    logo: "/logos/touch.png",
    supportGroup: "food",
    profile: "inventory-ops",
    widgets: ["queue", "analytics", "map", "inventory"],
    inventoryKind: "cooked-meals",
  },
  {
    id: "touch-medical-escort-transport",
    slug: "touch-medical-escort-transport",
    accountId: "touch",
    name: "TOUCH Medical Escort & Transport",
    shortName: "TOUCH MET",
    logo: "/logos/touch.png",
    supportGroup: "transport",
    profile: "schedule-ops",
    widgets: ["queue", "analytics", "map", "schedule"],
    scheduleKind: "transport",
  },
  {
    id: "food-from-the-heart",
    slug: "food-from-the-heart",
    accountId: "food-from-the-heart",
    name: "Food from the Heart",
    shortName: "FFTH",
    logo: "/logos/food-from-the-heart.png",
    supportGroup: "food",
    profile: "inventory-ops",
    widgets: ["queue", "analytics", "map", "inventory"],
    inventoryKind: "food-packs",
  },
  {
    id: "temasek-distribution",
    slug: "temasek-distribution",
    accountId: "temasek",
    name: "Temasek Foundation Distribution",
    shortName: "Temasek",
    logo: "/logos/temasek.png",
    supportGroup: "supplies",
    profile: "inventory-ops",
    widgets: ["queue", "analytics", "map", "inventory"],
    supplyRouteLabels: ["Masks", "Hand sanitiser"],
    inventoryKind: "public-supplies",
  },
  {
    id: "moh-art-kit-distribution",
    slug: "moh-art-kit-distribution",
    accountId: "moh",
    name: "MOH ART Kit Distribution",
    shortName: "MOH ART Kits",
    logo: "/logos/moh.png",
    supportGroup: "supplies",
    profile: "inventory-ops",
    widgets: ["queue", "analytics", "map", "inventory"],
    supplyRouteLabels: ["ART kits"],
    inventoryKind: "public-supplies",
  },
  {
    id: "nea-dengue-outreach",
    slug: "nea-dengue-outreach",
    accountId: "nea",
    name: "NEA Dengue Outreach",
    shortName: "NEA Dengue",
    logo: "/logos/nea.png",
    supportGroup: "supplies",
    profile: "inventory-ops",
    widgets: ["queue", "analytics", "map", "inventory"],
    supplyRouteLabels: ["Dengue kit / repellent pack"],
    inventoryKind: "public-supplies",
  },
];

export function getWorkspace(id: string): WorkspaceConfig {
  const workspace = WORKSPACES.find((w) => w.id === id);
  if (!workspace) throw new Error(`Unknown workspace: ${id}`);
  return workspace;
}

export function getWorkspaceBySlug(slug: string): WorkspaceConfig | undefined {
  return WORKSPACES.find((w) => w.slug === slug);
}

export function workspacesForAccount(accountId: string): WorkspaceConfig[] {
  return WORKSPACES.filter((w) => w.accountId === accountId);
}

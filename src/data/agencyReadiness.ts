import type { OrgId } from "@/lib/orgs";

export type StockItem = {
  id: string;
  name: string;
  quantity: number;
  reorderAt: number;
  unit: string;
};

export type CapacityUnit = {
  id: string;
  name: string;
  available: number;
  capacity: number;
  focus: string;
};

export type ReadinessItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status: "OK" | "Watch" | "Low";
  actionLabel?: string;
  queuedLabel?: string;
};

export const supplyInventory: StockItem[] = [
  { id: "masks", name: "Masks", quantity: 420, reorderAt: 250, unit: "boxes" },
  { id: "repellent", name: "Repellent", quantity: 64, reorderAt: 80, unit: "bottles" },
  { id: "thermometers", name: "Thermometers", quantity: 28, reorderAt: 40, unit: "sets" },
  { id: "hygiene", name: "Hygiene kits", quantity: 112, reorderAt: 90, unit: "packs" },
];

export const readinessUnits: Record<OrgId, CapacityUnit[]> = {
  AIC: [
    { id: "aac-east", name: "AAC East cluster", available: 3, capacity: 5, focus: "Emergency alert response" },
    { id: "aac-central", name: "AAC Central cluster", available: 4, capacity: 6, focus: "Befriending and referrals" },
    { id: "aac-west", name: "AAC West cluster", available: 2, capacity: 4, focus: "Care-navigation follow-up" },
  ],
  SGCares: [
    { id: "vol-a", name: "Volunteer Team A", available: 14, capacity: 20, focus: "Supplies drops" },
    { id: "vol-b", name: "Volunteer Team B", available: 9, capacity: 18, focus: "Meal delivery" },
    { id: "befrienders", name: "Befriender Squad", available: 7, capacity: 12, focus: "Domain A welfare checks" },
    { id: "outreach", name: "Outreach Team", available: 11, capacity: 16, focus: "Doorstep checks" },
  ],
  AACSGO: [
    { id: "sga", name: "SGA Outreach Team", available: 5, capacity: 8, focus: "Unreachable seniors" },
    { id: "aac-bef", name: "AAC Befriender Team", available: 6, capacity: 10, focus: "Social isolation" },
    { id: "referral", name: "Senior Referral Desk", available: 4, capacity: 6, focus: "Care referrals" },
  ],
  SSOFSC: [
    { id: "sso-intake", name: "SSO Intake Desk", available: 3, capacity: 5, focus: "Urgent basic needs" },
    { id: "fsc-casework", name: "FSC Casework Team", available: 5, capacity: 7, focus: "Family support" },
    { id: "comcare", name: "ComCare Support Desk", available: 2, capacity: 4, focus: "Vouchers and food rations" },
    { id: "liaison", name: "Community Partner Liaison", available: 4, capacity: 6, focus: "Partner handoff" },
  ],
  AICCare: [
    { id: "mow", name: "Meals on Wheels Desk", available: 6, capacity: 9, focus: "Meal support" },
    { id: "met", name: "MET Coordination Desk", available: 3, capacity: 5, focus: "Clinic transport" },
    { id: "care-nav", name: "Care Navigation Desk", available: 5, capacity: 8, focus: "Service navigation" },
  ],
};

export const readinessItems: Record<OrgId, ReadinessItem[]> = {
  AIC: supplyInventory.map((item) => {
    const low = item.quantity <= item.reorderAt;
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      status: low ? "Low" : "OK",
      actionLabel: low ? "Queue order" : undefined,
      queuedLabel: low ? "Order queued" : undefined,
    };
  }),
  SGCares: [
    { id: "language-roster", name: "Language roster", quantity: 9, unit: "volunteers", status: "OK" },
    { id: "driver-pool", name: "Transport volunteers", quantity: 6, unit: "available", status: "Watch", actionLabel: "Queue backup", queuedLabel: "Backup queued" },
    { id: "runner-pool", name: "Supplies runners", quantity: 12, unit: "available", status: "OK" },
  ],
  AACSGO: [
    { id: "phone-checks", name: "Phone-check slots", quantity: 15, unit: "today", status: "OK" },
    { id: "home-visits", name: "Home-visit slots", quantity: 4, unit: "today", status: "Watch", actionLabel: "Queue backup", queuedLabel: "Backup queued" },
    { id: "referral-followup", name: "Referral follow-ups", quantity: 8, unit: "open", status: "OK" },
    { id: "language-support", name: "Dialect support", quantity: 6, unit: "staff", status: "OK" },
  ],
  SSOFSC: [
    { id: "intake-slots", name: "Intake slots", quantity: 8, unit: "today", status: "OK" },
    { id: "food-vouchers", name: "Food vouchers", quantity: 11, unit: "packs", status: "OK" },
    { id: "ration-kits", name: "Ration kits", quantity: 6, unit: "ready", status: "Watch", actionLabel: "Queue backup", queuedLabel: "Backup queued" },
  ],
  AICCare: [
    { id: "meal-slots", name: "Meal slots", quantity: 12, unit: "today", status: "OK" },
    { id: "met-vehicles", name: "MET vehicles", quantity: 3, unit: "available", status: "Watch", actionLabel: "Queue backup", queuedLabel: "Backup queued" },
    { id: "link-callbacks", name: "AIC Link callbacks", quantity: 8, unit: "open", status: "OK" },
    { id: "soft-diet", name: "Soft-diet meals", quantity: 10, unit: "slots", status: "OK" },
  ],
};

export function availableUnits(org: OrgId): number {
  return readinessUnits[org].filter((unit) => unit.available > 0).length;
}

export function availableSlots(org: OrgId): number {
  return readinessUnits[org].reduce((sum, unit) => sum + unit.available, 0);
}

export function lowStockItems(): StockItem[] {
  return supplyInventory.filter((item) => item.quantity <= item.reorderAt);
}

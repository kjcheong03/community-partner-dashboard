// ---------------------------------------------------------------------------
// ORCA request contract — SINGLE SOURCE OF TRUTH.
//
// Producer: the ORCA caregiver app (emits RequestSession on submit).
// Consumer: the community-partner dashboard kit (imports a synced copy).
//
// Zero-dependency, pure TypeScript. Do not import app/UI code here.
// The caregiver app re-exports these from lib/community.ts for back-compat.
// ---------------------------------------------------------------------------

// --- support types ---------------------------------------------------------

export type SupportTypeId = "supplies" | "food" | "welfare" | "transport" | "referral";

export const supportTypeLabels: Record<SupportTypeId, string> = {
  supplies: "Health / emergency supplies",
  food: "Food / meal support",
  welfare: "Welfare check",
  transport: "Assisted transport",
  referral: "Care referral / navigation",
};

/** Route-based support types fan out to fulfilment routes; the rest are partner-assigned. */
export const ROUTE_BASED_TYPES: SupportTypeId[] = ["supplies", "food"];
export function isRouteBasedType(type: SupportTypeId): boolean {
  return ROUTE_BASED_TYPES.includes(type);
}

// --- lifecycle status ------------------------------------------------------

/**
 * Lifecycle of a request / task / route, mirroring the partner dashboard.
 * New submissions start "Pending"; partners advance them and the caregiver app
 * reads the updated session/task/route status back from storage.
 */
export type RequestStatus =
  | "Pending"
  | "Accepted"
  | "In progress"
  | "Completed"
  | "Rejected"
  | "Cancelled";

export type TaskScheduleStatus = "Scheduled" | "In progress" | "Completed" | "Cancelled" | "Rescheduled";

/** Allowed status transitions, by fulfilment kind. */
export const TRANSITIONS: Record<"full" | "reduced", Record<RequestStatus, RequestStatus[]>> = {
  // partner_service routes (food) + all partner-assigned tasks — an accountable actor can act.
  full: {
    Pending: ["Accepted", "Rejected"],
    Accepted: ["In progress", "Completed", "Cancelled"],
    "In progress": ["Completed", "Cancelled"],
    Completed: [],
    Rejected: [],
    Cancelled: [],
  },
  // public / community distribution routes use the same broad lifecycle without rejection.
  reduced: {
    Pending: ["Accepted", "Cancelled"],
    Accepted: ["In progress", "Completed", "Cancelled"],
    "In progress": ["Completed", "Cancelled"],
    Completed: [],
    Rejected: [],
    Cancelled: [],
  },
};

/**
 * Roll a set of child statuses up to a parent (route→task for food, task→session).
 * Patched so every terminal combination is covered.
 */
export function rollupStatus(statuses: RequestStatus[]): RequestStatus {
  if (statuses.length === 0) return "Pending";
  if (statuses.includes("Pending")) return "Pending";
  if (statuses.some((s) => s === "Accepted" || s === "In progress")) return "In progress";
  // everything terminal from here
  if (statuses.some((s) => s === "Completed")) return "Completed"; // partial success reads better than failure
  if (statuses.some((s) => s === "Rejected")) return "Rejected"; // a rejection is more actionable than a cancellation
  return "Cancelled"; // all cancelled
}

export function isTerminalStatus(status: RequestStatus): boolean {
  return status === "Completed" || status === "Rejected" || status === "Cancelled";
}

export function requestRef(sessionId: string): string {
  const id = sessionId.trim();
  const requestMatch = id.match(/^req-(.+)$/i);
  if (requestMatch) return `REQ-${requestMatch[1]}`;

  const seedMatch = id.match(/^demo-seed-(\d+)$/i);
  if (seedMatch) return `REQ-${String(900000 + Number(seedMatch[1])).padStart(6, "0")}`;

  const curatedMatch = id.match(/^demo-account-(\d+)$/i);
  if (curatedMatch) return `REQ-${String(800000 + Number(curatedMatch[1])).padStart(6, "0")}`;

  return `REQ-${id.replace(/[^a-z0-9-]/gi, "").slice(0, 12).toUpperCase()}`;
}

// --- cost ------------------------------------------------------------------

export type CostType = "free" | "fixed" | "mixed" | "estimated" | "partnerReview";

export interface CostBreakdownLine {
  label: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  min?: number;
  max?: number;
  costType: string;
}

export interface CostEstimate {
  costType: CostType;
  /** Display override for the cost chip (e.g. "Free / partner assessment"). */
  label?: string;
  /** Explanatory line shown beneath the chip. */
  detail?: string;
  min?: number;
  max?: number;
  total?: number;
  currency: "SGD";
  partnerConfirms: boolean;
  paymentHandledBy?: "partner";
  breakdown: CostBreakdownLine[];
}

// --- fulfilment routes -----------------------------------------------------

export type SupplyAvailabilityMode =
  | "active_distribution_exercise"
  | "local_stock_subject_to_availability"
  | "partner_assessment"
  | "unavailable";

export type FulfilmentCheckpointStage =
  | "accepted"
  | "meal_plan_confirmed"
  | "meal_preparing"
  | "packing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed";

export interface FulfilmentCheckpoint {
  stage: FulfilmentCheckpointStage;
  label: string;
  completedAt: string;
  actorName?: string;
  notes?: string;
}

/** A per-item (supplies) / per-subtype (food) fulfilment route. */
export interface FulfilmentRoute {
  label: string;
  quantity?: number;
  /** Owning dashboard workspace for this route. Distribution routes are scoped by this id. */
  workspaceId?: string;
  routeName: string;
  /** Logo path under /public; falls back to a letter. */
  logo?: string;
  /** Real partner-org id when the route is a `partner_service` (food); absent for public exercises. */
  organisationId?: string;
  routeType: "public_distribution" | "community_distribution" | "partner_service";
  availabilityMode: SupplyAvailabilityMode;
  costLabel: string;
  detail?: string;
  /** Availability note emitted by the producer (e.g. "Available while stock lasts"). NOT a lifecycle state. */
  status: string;
  /** Workflow state — dashboard-set per route. Distribution uses the reduced lifecycle. */
  lifecycle?: RequestStatus;
  /** Persisted operational checkpoints for route fulfilment. */
  checkpoints?: FulfilmentCheckpoint[];
  /** Caregiver/operator-facing latest checkpoint label, falling back to lifecycle status. */
  displayStatus?: string;
  displayStatusUpdatedAt?: string;
}

// --- request session (what the producer emits on submit) -------------------

export interface RequestTaskSession {
  /** Per-session id (currently the support type — unique within a session, not globally). */
  id: string;
  /** Discriminant: route-based (supplies/food) vs partner-assigned (welfare/transport/referral). */
  fulfilment: "route" | "partner";
  supportType: SupportTypeId;
  selectedSubtypes: string[];
  details: Record<string, unknown>;
  /** Partner-assigned only; "" for route-based. */
  primaryOrganisationId: string;
  fallbackOrganisationIds: string[];
  /** Route-based only (supplies + food). */
  fulfilmentRoutes?: FulfilmentRoute[];
  /** Partner-assigned only. */
  costEstimate?: CostEstimate;
  status: RequestStatus;
  // --- dashboard-set workflow fields (absent at submit) ---
  assignedTo?: string;
  rejectionReason?: string;
  scheduledFor?: string;
  scheduleStatus?: TaskScheduleStatus;
  rescheduledFrom?: string;
  partnerNotes?: string;
}

export interface RequestSession {
  id: string;
  careRecipientName: string;
  caregiverName: string;
  contactNumber: string;
  contactMethod: string;
  email?: string;
  relationship?: string;
  /** Location — present only when the request collected it. */
  generalArea?: string;
  address?: string;
  postalCode?: string;
  accessNotes?: string;
  linkedTopic: string;
  createdAt: string;
  overallStatus: RequestStatus;
  tasks: RequestTaskSession[];
}

// --- discrimination guards (robust to pre-discriminant stored data) --------

export function isRouteBased(task: RequestTaskSession): boolean {
  return task.fulfilment ? task.fulfilment === "route" : isRouteBasedType(task.supportType);
}
export function isPartnerAssigned(task: RequestTaskSession): boolean {
  return !isRouteBased(task);
}
export function isDistributionTask(task: RequestTaskSession): boolean {
  return isRouteBased(task) && (task.fulfilmentRoutes ?? []).some((route) => route.routeType !== "partner_service");
}
export function isCheckpointManagedRoute(
  task: Pick<RequestTaskSession, "supportType" | "details">,
  route: Pick<FulfilmentRoute, "label">,
): boolean {
  return (
    task.supportType === "supplies"
    || (task.supportType === "food" && (route.label === "Food pack / rations" || route.label === "Cooked meals"))
  );
}

/**
 * A task's effective status: route-based tasks roll up each route lifecycle;
 * partner-assigned tasks use their own status.
 */
export function taskStatus(task: RequestTaskSession): RequestStatus {
  const routes = task.fulfilmentRoutes ?? [];
  if (routes.length) return rollupStatus(routes.map((route) => route.lifecycle ?? "Pending"));
  return task.status;
}

export function taskDisplayStatus(task: RequestTaskSession): string {
  const status = taskStatus(task);
  if (isRouteBased(task)) return status;
  if (status !== "In progress" || !task.scheduledFor) return status;
  return task.scheduleStatus === "Rescheduled" ? "Rescheduled" : "Scheduled";
}

export function routeStatus(route: FulfilmentRoute): RequestStatus {
  return route.lifecycle ?? "Pending";
}

export const CHECKPOINT_LABELS: Record<FulfilmentCheckpointStage, string> = {
  accepted: "Accepted",
  meal_plan_confirmed: "Meal plan confirmed",
  meal_preparing: "Added to MOW schedule",
  packing: "Packing",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
};

export function checkpointLabel(stage: FulfilmentCheckpointStage): string {
  return CHECKPOINT_LABELS[stage];
}

export function routeCheckpointStages(
  task: Pick<RequestTaskSession, "supportType" | "details">,
  route: Pick<FulfilmentRoute, "label">,
): FulfilmentCheckpointStage[] {
  if (!isCheckpointManagedRoute(task, route)) return [];
  if (task.supportType === "food" && route.label === "Cooked meals") {
    return ["accepted", "meal_plan_confirmed", "meal_preparing"];
  }
  return ["accepted", "packing", routeHandoffStage(task), "completed"];
}

export function routeDisplayStatus(task: RequestTaskSession, route: FulfilmentRoute): string {
  if (route.displayStatus) return route.displayStatus;
  const checkpoints = route.checkpoints ?? [];
  if (checkpoints.length) return checkpoints[checkpoints.length - 1].label;
  return routeStatus(route);
}

export function routeDisplayStatusUpdatedAt(route: FulfilmentRoute): string | undefined {
  if (route.displayStatusUpdatedAt) return route.displayStatusUpdatedAt;
  const checkpoints = route.checkpoints ?? [];
  return checkpoints[checkpoints.length - 1]?.completedAt;
}

export function nextRouteCheckpointStage(
  task: Pick<RequestTaskSession, "supportType" | "details">,
  route: Pick<FulfilmentRoute, "label" | "checkpoints">,
): FulfilmentCheckpointStage | null {
  const stages = routeCheckpointStages(task, route);
  if (!stages.length) return null;
  const completed = new Set((route.checkpoints ?? []).map((checkpoint) => checkpoint.stage));
  return stages.find((stage) => !completed.has(stage)) ?? null;
}

export interface RouteStatusSummary {
  label: string;
  routeName: string;
  workspaceId?: string;
  routeType: FulfilmentRoute["routeType"];
  status: RequestStatus;
  displayStatus: string;
  displayStatusUpdatedAt?: string;
  isTerminal: boolean;
}

export interface TaskStatusSummary {
  id: string;
  supportType: SupportTypeId;
  selectedSubtypes: string[];
  status: RequestStatus;
  rawStatus: RequestStatus;
  displayStatus: string;
  isTerminal: boolean;
  rejectionReason?: string;
  scheduledFor?: string;
  partnerNotes?: string;
  routes: RouteStatusSummary[];
}

export interface RequestStatusSummary {
  requestRef: string;
  sessionId: string;
  overallStatus: RequestStatus;
  isTerminal: boolean;
  tasks: TaskStatusSummary[];
}

export interface RequestRerouteHistory {
  sessionId: string;
  taskId: string;
  fromOrgId: string;
  toOrgId: string;
  reason?: string;
  reroutedAt: string;
}

export function taskStatusSummary(task: RequestTaskSession): TaskStatusSummary {
  const status = taskStatus(task);
  return {
    id: task.id,
    supportType: task.supportType,
    selectedSubtypes: task.selectedSubtypes,
    status,
    rawStatus: task.status,
    displayStatus: taskDisplayStatus(task),
    isTerminal: isTerminalStatus(status),
    rejectionReason: task.rejectionReason,
    scheduledFor: task.scheduledFor,
    partnerNotes: task.partnerNotes,
    routes: (task.fulfilmentRoutes ?? []).map((route) => {
      const routeCurrentStatus = routeStatus(route);
      return {
        label: route.label,
        routeName: route.routeName,
        workspaceId: route.workspaceId,
        routeType: route.routeType,
        status: routeCurrentStatus,
        displayStatus: routeDisplayStatus(task, route),
        displayStatusUpdatedAt: routeDisplayStatusUpdatedAt(route),
        isTerminal: isTerminalStatus(routeCurrentStatus),
      };
    }),
  };
}

export function requestStatusSummary(session: RequestSession): RequestStatusSummary {
  return {
    requestRef: requestRef(session.id),
    sessionId: session.id,
    overallStatus: session.overallStatus,
    isTerminal: isTerminalStatus(session.overallStatus),
    tasks: session.tasks.map(taskStatusSummary),
  };
}

function routeHandoffStage(task: Pick<RequestTaskSession, "supportType" | "details">): FulfilmentCheckpointStage {
  const text = [
    str(task.details, "suppliesFulfilment"),
    str(task.details, "fulfilmentMethod"),
    str(task.details, "preferredDeliveryWindow"),
    str(task.details, "preferredDeliveryTime"),
    str(task.details, "packAccessNotes"),
  ].join(" ").toLowerCase();

  return text.includes("deliver") || text.includes("delivery") ? "out_for_delivery" : "ready_for_pickup";
}

// --- work items (the dashboard's atomic, owner-scoped unit) ----------------
//
// Routed tasks fan out: a food task with cooked-meals + food-pack produces two
// `food-route` items owned by two different orgs. Supplies produce one
// `supplies-route` item per distribution workspace/channel.

export interface WorkItem {
  /** Stable id: `${sessionId}:${supportType}` or `${sessionId}:${supportType}:${routeLabel}`. */
  id: string;
  sessionId: string;
  ownerOrgId: string | null;
  relation: "primary" | "backup" | "owner";
  supportType: SupportTypeId;
  kind: "partner-task" | "supplies-route" | "food-route";
  status: RequestStatus;
  transitions: RequestStatus[];
  task: RequestTaskSession;
  route?: FulfilmentRoute;
  session: RequestSession;
}

/**
 * Flatten sessions into owner-scoped work items. Pass `orgId` to scope to one
 * partner/workspace (sees its partner-assigned tasks where it's primary/backup,
 * its own food routes, and distribution routes owned by that workspace).
 * Omit `ownerId` for an unscoped/admin view.
 */
export function flattenToWorkItems(sessions: RequestSession[], ownerId?: string): WorkItem[] {
  const items: WorkItem[] = [];

  for (const session of sessions) {
    for (const task of session.tasks) {
      if (isPartnerAssigned(task)) {
        const isPrimary = task.primaryOrganisationId === ownerId;
        const isBackup = task.fallbackOrganisationIds.includes(ownerId ?? "");
        if (ownerId && !isPrimary && !isBackup) continue;
        items.push({
          id: `${session.id}:${task.supportType}`,
          sessionId: session.id,
          ownerOrgId: task.primaryOrganisationId || null,
          relation: isBackup && !isPrimary ? "backup" : "primary",
          supportType: task.supportType,
          kind: "partner-task",
          status: task.status,
          transitions: TRANSITIONS.full[task.status],
          task,
          session,
        });
        continue;
      }

      // route-based
      const routes = task.fulfilmentRoutes ?? [];
      for (const route of routes) {
        const status = route.lifecycle ?? "Pending";
        if (route.routeType === "partner_service") {
          // food — one item per route, owned by the route's org
          if (ownerId && route.organisationId !== ownerId) continue;
          items.push({
            id: `${session.id}:${task.supportType}:${route.label}`,
            sessionId: session.id,
            ownerOrgId: route.organisationId ?? null,
            relation: "owner",
            supportType: task.supportType,
            kind: "food-route",
            status,
            transitions: TRANSITIONS.full[status],
            task,
            route,
            session,
          });
          continue;
        }

        if (ownerId && route.workspaceId && route.workspaceId !== ownerId) continue;
        if (ownerId && !route.workspaceId) continue;
        items.push({
          id: `${session.id}:${task.supportType}:${route.label}`,
          sessionId: session.id,
          ownerOrgId: null,
          relation: "owner",
          supportType: task.supportType,
          kind: "supplies-route",
          status,
          transitions: TRANSITIONS.reduced[status],
          task,
          route,
          session,
        });
      }
    }
  }

  return items;
}

// --- derived display helpers (priority · needed-by · detail rows) ----------
// Shared so the dashboard renders identically to the form, instead of re-guessing.

export type UrgencyTier = "high" | "medium" | "low";

function str(details: Record<string, unknown>, key: string): string {
  const v = details[key];
  if (typeof v === "string") return v.trim();
  return v != null && typeof v !== "object" ? String(v) : "";
}
function list(details: Record<string, unknown>, key: string): string[] {
  const v = details[key];
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : [];
}

const HIGH_TOKENS = new Set(["today", "today, if available"]);
const MEDIUM_TOKENS = new Set(["tomorrow", "within 2–3 days", "2–3 days", "this week"]);

function tierFromToken(raw: string): UrgencyTier | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (HIGH_TOKENS.has(t)) return "high";
  if (MEDIUM_TOKENS.has(t)) return "medium";
  if (t === "not urgent") return "low";
  return null;
}
function tierFromDate(targetIso: string, refIso?: string): UrgencyTier | null {
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;
  const ref = refIso ? new Date(refIso).getTime() : Date.now();
  const days = Math.floor((target - ref) / 86_400_000);
  if (days <= 0) return "high"; // due today or overdue
  if (days <= 3) return "medium";
  return "low";
}
const TIER_RANK: Record<UrgencyTier, number> = { high: 3, medium: 2, low: 1 };
function maxTier(...tiers: (UrgencyTier | null)[]): UrgencyTier {
  const present = tiers.filter((t): t is UrgencyTier => t != null);
  return present.length ? present.reduce((a, b) => (TIER_RANK[b] > TIER_RANK[a] ? b : a)) : "low";
}

/** Priority tier, derived from each support type's own timing field. `refIso` = the request's createdAt. */
export function deriveUrgency(task: RequestTaskSession, refIso?: string): UrgencyTier {
  const d = task.details;
  switch (task.supportType) {
    case "supplies":
      return tierFromToken(str(d, "neededBy")) ?? "low";
    case "food": {
      const cooked =
        str(d, "startDate") === "Choose date"
          ? tierFromDate(str(d, "startDateValue"), refIso)
          : tierFromToken(str(d, "startDate"));
      return maxTier(cooked, tierFromToken(str(d, "neededBy")));
    }
    case "welfare":
      return (
        (str(d, "checkInDay") === "Choose date"
          ? tierFromDate(str(d, "checkInDayValue"), refIso)
          : tierFromToken(str(d, "checkInDay"))) ?? "low"
      );
    case "referral":
      return tierFromToken(str(d, "urgency")) ?? "low";
    case "transport":
      return tierFromDate(str(d, "appointmentDateTime"), refIso) ?? "low";
    default:
      return "low";
  }
}

function fmtDate(iso: string, withTime = false): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const date = dt.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  if (!withTime) return date;
  return `${date}, ${dt.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" })}`;
}
function resolveToken(token: string, refIso?: string): string {
  const t = token.trim().toLowerCase();
  if (!refIso) return token;
  if (t === "today" || t === "today, if available") return fmtDate(refIso);
  if (t === "tomorrow") {
    const d = new Date(refIso);
    d.setDate(d.getDate() + 1);
    return fmtDate(d.toISOString());
  }
  return token; // relative windows stay as phrases
}

/** Concrete "needed by" — exact date/time where one exists, window phrase otherwise. */
export function neededByLabel(task: RequestTaskSession, refIso?: string): string {
  const d = task.details;
  switch (task.supportType) {
    case "supplies":
      return resolveToken(str(d, "neededBy"), refIso);
    case "food":
      if (str(d, "startDate"))
        return str(d, "startDate") === "Choose date"
          ? fmtDate(str(d, "startDateValue"))
          : resolveToken(str(d, "startDate"), refIso);
      return resolveToken(str(d, "neededBy"), refIso);
    case "welfare":
      return str(d, "checkInDay") === "Choose date"
        ? fmtDate(str(d, "checkInDayValue"))
        : resolveToken(str(d, "checkInDay"), refIso);
    case "referral":
      return str(d, "urgency");
    case "transport":
      return str(d, "appointmentDateTime") ? fmtDate(str(d, "appointmentDateTime"), true) : "";
    default:
      return "";
  }
}

export interface DetailRow {
  label: string;
  value: string;
}

/**
 * The submitted request fields as label→value rows, mirroring the caregiver form
 * exactly (per support type, conditionals included). For food, pass `focusSubtype`
 * (a route's label) to show only that subtype's fields.
 */
export function detailRows(task: RequestTaskSession, focusSubtype?: string): DetailRow[] {
  const d = task.details;
  const rows: DetailRow[] = [];
  const push = (label: string, value: string) => {
    if (value && value.trim()) rows.push({ label, value: value.trim() });
  };
  const yesno = (label: string, key: string) => {
    if (d[key] === true) rows.push({ label, value: "Yes" });
  };

  switch (task.supportType) {
    case "supplies": {
      const items = Array.isArray(d.itemsNeeded)
        ? (d.itemsNeeded as { item: string; quantity?: string | number }[])
        : [];
      push(
        "Items",
        items
          .filter((i) => !focusSubtype || i.item === focusSubtype)
          .filter((i) => i.quantity)
          .map((i) => `${i.item}${i.quantity ? ` ×${i.quantity}` : ""}`)
          .join(", "),
      );
      push("Needed by", str(d, "neededBy"));
      push("Fulfilment", str(d, "suppliesFulfilment"));
      push("Preferred collection area", str(d, "preferredCollectionArea"));
      push("Preferred time", str(d, "preferredCollectionTime") || str(d, "preferredDeliveryTime"));
      push("Notes", str(d, "notes"));
      break;
    }
    case "food": {
      const cooked = focusSubtype ? focusSubtype === "Cooked meals" : true;
      const pack = focusSubtype ? focusSubtype === "Food pack / rations" : true;
      if (cooked && (str(d, "portionsPerMeal") || list(d, "mealsNeeded").length)) {
        push("Portions per meal", str(d, "portionsPerMeal"));
        push("Meals", list(d, "mealsNeeded").join(" + "));
        push("Start", str(d, "startDate") === "Choose date" ? str(d, "startDateValue") : str(d, "startDate"));
        push("Duration", str(d, "duration"));
        push(
          "Dietary restrictions",
          [list(d, "dietaryRestrictions").join(", "), str(d, "dietaryRestrictionsOther")]
            .filter(Boolean)
            .join(" · "),
        );
        push("Preferred delivery time", str(d, "preferredDeliveryTime"));
      }
      if (pack && (str(d, "packType") || str(d, "numberOfPacks"))) {
        push("Pack type", str(d, "packType"));
        push("Number of packs", str(d, "numberOfPacks") === "Other" ? str(d, "numberOfPacksOther") : str(d, "numberOfPacks"));
        push("Needed by", str(d, "neededBy"));
        push("Fulfilment", str(d, "fulfilmentMethod"));
        push("Preferred delivery window", str(d, "preferredDeliveryWindow"));
        push("Preferred pickup area", str(d, "pickupArea"));
        push("Preferred pickup time", str(d, "pickupTime"));
        push("Preferred area", str(d, "generalPreferredArea"));
        push("Timing", str(d, "timingConstraints"));
        push("Access notes", str(d, "packAccessNotes"));
        push(
          "Food restrictions",
          [list(d, "foodRestrictions").join(", "), str(d, "restrictionNotes")].filter(Boolean).join(" · "),
        );
      }
      push("Notes", str(d, "notes"));
      break;
    }
    case "welfare": {
      push("Specify", str(d, "specifyOther"));
      push("Check method", str(d, "checkMethod"));
      push("When", str(d, "checkInDay") === "Choose date" ? str(d, "checkInDayValue") : str(d, "checkInDay"));
      push("Preferred time", str(d, "preferredTime"));
      push("Preferred language", str(d, "language"));
      push("Safety notes", str(d, "safetyNotes"));
      push("Notes", str(d, "notes"));
      break;
    }
    case "transport": {
      push("Destination", str(d, "destination"));
      push("Appointment", str(d, "appointmentDateTime") ? fmtDate(str(d, "appointmentDateTime"), true) : "");
      push("Pickup location", str(d, "pickupArea"));
      yesno("Wheelchair required", "wheelchairRequired");
      yesno("Escort needed", "escortNeeded");
      yesno("Caregiver accompanying", "caregiverAccompanying");
      yesno("Return trip", "returnTripNeeded");
      push("Mobility notes", str(d, "mobilityNeeds"));
      push("Notes", str(d, "notes"));
      break;
    }
    case "referral": {
      push("Specify", str(d, "specifyOther"));
      push("Main concern", str(d, "mainConcern"));
      push("Current situation", str(d, "currentSituation"));
      push("Preferred language", str(d, "language"));
      push("Existing support", str(d, "existingSupport"));
      push("Notes", str(d, "notes"));
      break;
    }
  }
  return rows;
}

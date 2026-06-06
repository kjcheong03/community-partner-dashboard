"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import type { FeatureCollection } from "geojson";
import RequestQueue from "@/components/kit/RequestQueue";
import RequestDetailPanel from "@/components/kit/RequestDetailPanel";
import SlideOver from "@/components/kit/SlideOver";
import AnalyticsPanel from "@/components/kit/AnalyticsPanel";
import OrgLogo from "@/components/kit/OrgLogo";
import ScheduleBoard, { type ScheduleItem } from "@/components/kit/ScheduleBoard";
import ScheduleDetailPanel from "@/components/kit/ScheduleDetailPanel";
import InventoryTable, { type InventoryRow, type InventoryStatus } from "@/components/kit/InventoryTable";
import { pickColumns } from "@/components/kit/columns";
import { deriveUrgency } from "@/components/kit/format";
import {
  TRANSITIONS,
  flattenToWorkItems,
  rollupStatus,
  supportTypeLabels,
  taskStatus,
  type RequestSession,
  type RequestStatus,
  type WorkItem,
} from "@/lib/contract";
import { countByArea, generateSessions } from "@/lib/mock";
import type { DashboardScheduleAssignment, ScheduleStatus } from "@/lib/schedule";
import type { WorkspaceConfig } from "@/lib/workspaces";
import { updateInventoryStockAction, updateScheduleAssignmentStatusAction, updateWorkItemStatusAction } from "@/app/actions";

const MapHeatmap = dynamic(() => import("@/components/kit/MapHeatmap"), { ssr: false });

const WORKSPACE_COLUMNS = pickColumns([
  "id",
  "submittedBy",
  "detail",
  "area",
  "priority",
  "neededBy",
  "submitted",
  "status",
]);

type Props = {
  workspace: WorkspaceConfig;
  initialSessions?: RequestSession[];
  initialInventoryRows?: InventoryRow[] | null;
  initialScheduleAssignments?: DashboardScheduleAssignment[] | null;
};

type ScheduledWorkItem = WorkItem & {
  scheduleAssignment?: DashboardScheduleAssignment;
};

export default function WorkspaceDashboard({ workspace, initialSessions, initialInventoryRows, initialScheduleAssignments }: Props) {
  const router = useRouter();
  const liveData = initialSessions !== undefined;
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [sessions, setSessions] = useState<RequestSession[]>(() => initialSessions ?? generateSessions());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  const allItems = useMemo(() => itemsForWorkspace(sessions, workspace), [sessions, workspace]);
  const scheduledItems = useMemo(
    () => initialScheduleAssignments !== undefined
      ? scheduledWorkItemsFromAssignments(allItems, initialScheduleAssignments ?? [])
      : scheduledWorkItemsForWorkspace(allItems, workspace),
    [allItems, initialScheduleAssignments, workspace]
  );
  const scheduleItems = useMemo(() => scheduleItemsFromWorkItems(scheduledItems), [scheduledItems]);
  const inventory = useMemo(
    () => initialInventoryRows !== undefined
      ? { rows: initialInventoryRows ?? [], locationHeader: inventoryLocationHeader(workspace) }
      : inventoryForWorkspace(allItems, workspace),
    [allItems, initialInventoryRows, workspace]
  );
  const queueItems = useMemo(
    () => (regionFilter ? allItems.filter((it) => it.session.generalArea === regionFilter) : allItems),
    [allItems, regionFilter]
  );
  const areaCounts = useMemo(() => countByArea(allItems).map((a) => ({ region: a.area, count: a.count })), [allItems]);

  const selected = allItems.find((i) => i.id === selectedId) ?? null;
  const selectedSchedule = scheduledItems.find((i) => i.id === selectedScheduleId) ?? null;

  useEffect(() => {
    fetch("/sg-planning-areas.json")
      .then((r) => r.json())
      .then((g: FeatureCollection) => setGeojson(g))
      .catch(() => setGeojson(null));
  }, []);

  function handleRefreshQueue() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function handleStatusChange(item: WorkItem, next: RequestStatus, reason?: string) {
    setSessions((prev) => applyStatus(prev, item, next, reason));
    if (!liveData) return;

    const result = await updateWorkItemStatusAction({
      workspaceSlug: workspace.slug,
      taskId: item.route ? null : workItemTaskDbId(item),
      routeId: item.route ? workItemRouteDbId(item) : null,
      next,
      reason,
    });

    if (!result.ok) {
      console.error("Failed to update request status", result.error);
      return;
    }

    router.refresh();
  }

  async function handleSaveStock(row: InventoryRow, available: number, topUp: number) {
    if (!liveData || !row.id || row.children?.length) return;
    const result = await updateInventoryStockAction({
      workspaceSlug: workspace.slug,
      inventoryItemId: row.id,
      available,
      fulfilled: row.fulfilled ?? 0,
      reason: topUp > 0 ? `Dashboard stock edit; top up ${topUp}` : "Dashboard stock edit",
    });

    if (!result.ok) {
      console.error("Failed to update inventory stock", result.error);
      return;
    }

    router.refresh();
  }

  async function handleScheduleStatusChange(item: ScheduledWorkItem, next: ScheduleStatus) {
    const assignmentId = item.scheduleAssignment?.id;
    if (!liveData || !assignmentId) return;

    const result = await updateScheduleAssignmentStatusAction({
      workspaceSlug: workspace.slug,
      scheduleAssignmentId: assignmentId,
      next,
    });

    if (!result.ok) {
      console.error("Failed to update schedule assignment", result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 text-slate-800 shadow-sm">
          <p className="truncate text-[17px] font-semibold">Community Partner Dashboard</p>
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <OrgLogo
              name={workspace.name}
              logo={workspace.logo}
              size={44}
              className="rounded-xl bg-white text-[#0b2f57] ring-1 ring-black/[0.06]"
            />
            <h1 className="truncate text-[17px] font-semibold">{workspace.name}</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="flex flex-col gap-4 px-4 pb-4 pt-2 lg:px-5 lg:pb-5 lg:pt-2.5">
            {workspace.widgets.includes("analytics") && (
              <Section>
                <AnalyticsPanel items={allItems} />
              </Section>
            )}

            {workspace.widgets.includes("inventory") && inventory.rows.length > 0 && (
              <Section>
                <InventoryTable
                  key={inventoryTableKey(workspace, inventory.rows)}
                  rows={inventory.rows}
                  locationHeader={inventory.locationHeader}
                  onSaveStock={handleSaveStock}
                />
              </Section>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              {workspace.widgets.includes("queue") && (
                <Section className="min-h-[500px]">
                  <RequestQueue
                    items={queueItems}
                    columns={WORKSPACE_COLUMNS}
                    selectedId={selectedId}
                    onSelect={(it) => setSelectedId(it.id)}
                    defaultSortKey="submitted"
                    defaultSortDir="desc"
                    showAllColumns
                    statusTabs
                    toolbarAction={
                      liveData || regionFilter ? (
                        <QueueActions
                          refreshing={isRefreshing}
                          showRefresh={liveData}
                          regionFilter={regionFilter}
                          onRefresh={handleRefreshQueue}
                          onClearRegion={() => setRegionFilter(null)}
                        />
                      ) : null
                    }
                    todoEmptyTitle="Nothing to do right now"
                    todoEmptyHint={`New requests routed to ${workspace.shortName} will appear here.`}
                    closedEmptyTitle="No closed requests"
                    closedEmptyHint="Completed and rejected requests are archived here."
                  />
                </Section>
              )}

              {workspace.widgets.includes("map") && (
                <Section>
                  {geojson ? (
                    <MapHeatmap
                      data={areaCounts}
                      geojson={geojson}
                      height={360}
                      onRegionClick={(region) => {
                        setRegionFilter(region);
                        setSelectedId(null);
                        setSelectedScheduleId(null);
                      }}
                    />
                  ) : (
                    <div className="flex h-[360px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-400">
                      Loading map...
                    </div>
                  )}
                </Section>
              )}
            </div>

            {workspace.widgets.includes("schedule") && (
              <Section>
                <ScheduleBoard
                  items={scheduleItems}
                  onSelect={(id) => {
                    setSelectedId(null);
                    setSelectedScheduleId(id);
                  }}
                />
              </Section>
            )}
          </div>
        </main>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <RequestDetailPanel
            item={selected}
            onStatusChange={handleStatusChange}
            onClose={() => setSelectedId(null)}
          />
        )}
      </SlideOver>

      <SlideOver open={!!selectedSchedule} onClose={() => setSelectedScheduleId(null)}>
        {selectedSchedule && (
          <ScheduleDetailPanel
            item={selectedSchedule}
            onScheduleStatusChange={handleScheduleStatusChange}
            onClose={() => setSelectedScheduleId(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

function itemsForWorkspace(sessions: RequestSession[], workspace: WorkspaceConfig): WorkItem[] {
  if (workspace.supplyRouteLabels?.length) {
    const allowed = new Set(workspace.supplyRouteLabels);
    const scoped = flattenToWorkItems(sessions, workspace.id)
      .filter((it) => it.kind === "supplies-route" && it.route && allowed.has(it.route.label));
    if (scoped.length) return scoped;

    // Mock/legacy sessions may not carry route.workspaceId yet. Keep the local
    // fallback route-granular by matching the workspace's known supply labels.
    return flattenToWorkItems(sessions)
      .filter((it) => it.kind === "supplies-route" && it.route && allowed.has(it.route.label))
      .map((it) => ({ ...it, id: `${it.id}:${workspace.id}` }));
  }

  return flattenToWorkItems(sessions, workspace.id).filter((i) => i.relation !== "backup");
}

function scheduledWorkItemsForWorkspace(items: WorkItem[], workspace: WorkspaceConfig): WorkItem[] {
  if (!workspace.scheduleKind) return [];

  const candidates = items
    .filter((it) => ["Accepted", "In progress", "Completed"].includes(it.status))
    .filter((it) => workspace.scheduleKind === "transport" ? it.supportType === "transport" : it.supportType === "welfare" || it.supportType === "referral")
    .sort((a, b) => scheduleStatusRank(a.status) - scheduleStatusRank(b.status) || new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime());

  let activeUsed = false;
  return candidates.flatMap((it, index) => {
    if (it.status === "In progress") {
      if (activeUsed) return [];
      activeUsed = true;
    }

    const scheduledFor = workspace.scheduleKind === "transport"
      ? transportScheduleTime(it)
      : outreachScheduleTime(index, it.status);
    const assignedTo = workspace.scheduleKind === "transport"
      ? transportAssignee(index)
      : outreachAssignee(index);
    const task = {
      ...it.task,
      assignedTo,
      scheduledFor,
      details: {
        ...it.task.details,
        ...(it.supportType === "referral" ? { checkMethod: it.session.contactMethod || "Phone call" } : {}),
      },
    };

    return [{
      ...it,
      task,
      transitions: TRANSITIONS.full[it.status],
    }];
  });
}

function scheduledWorkItemsFromAssignments(items: WorkItem[], assignments: DashboardScheduleAssignment[]): ScheduledWorkItem[] {
  return assignments
    .flatMap((assignment) => {
      const item = items.find((candidate) => scheduleAssignmentMatchesWorkItem(assignment, candidate));
      if (!item) return [];

      return [{
        ...item,
        id: `schedule:${assignment.id}`,
        status: assignment.requestStatus,
        task: {
          ...item.task,
          assignedTo: assignment.assigneeName,
          scheduledFor: assignment.scheduledFor,
          partnerNotes: assignment.notes ?? item.task.partnerNotes,
        },
        scheduleAssignment: assignment,
      }];
    })
    .sort((a, b) => new Date(a.scheduleAssignment?.scheduledFor ?? 0).getTime() - new Date(b.scheduleAssignment?.scheduledFor ?? 0).getTime());
}

function scheduleAssignmentMatchesWorkItem(assignment: DashboardScheduleAssignment, item: WorkItem) {
  if (assignment.routeId) return workItemRouteDbId(item) === assignment.routeId;
  if (assignment.taskId) return workItemTaskDbId(item) === assignment.taskId;
  return false;
}

function scheduleItemsFromWorkItems(items: ScheduledWorkItem[]): ScheduleItem[] {
  return items.map((it) => {
    const type = it.task.selectedSubtypes[0] || it.route?.label || supportTypeLabels[it.supportType];
    const scheduleStatus = it.scheduleAssignment?.scheduleStatus;
    return {
      id: it.id,
      title: `${type} · ${it.session.careRecipientName}`,
      when: it.task.scheduledFor ?? "",
      meta: `${it.session.generalArea ?? "Unknown area"} · ${it.status}`,
      assignee: it.task.assignedTo?.trim() || "Unassigned",
      status: it.status,
      scheduleStatus: scheduleStatus ?? (it.status === "In progress" ? "In progress" : it.status === "Completed" ? "Completed" : "Scheduled"),
      visitMode: visitModeFromWorkItem(it),
      priority: deriveUrgency(it.task, it.session.createdAt),
      kind: it.supportType,
    };
  });
}

function scheduleStatusRank(status: RequestStatus) {
  if (status === "Completed") return 0;
  if (status === "In progress") return 1;
  return 2;
}

function outreachScheduleTime(index: number, status: RequestStatus) {
  const completedSlots = [isoSgt(2026, 6, 5, 9, 15), isoSgt(2026, 6, 5, 10, 30)];
  const acceptedSlots = [isoSgt(2026, 6, 6, 9, 30), isoSgt(2026, 6, 6, 11, 0), isoSgt(2026, 6, 6, 14, 0), isoSgt(2026, 6, 6, 16, 0)];
  if (status === "Completed") return completedSlots[index % completedSlots.length];
  if (status === "In progress") return isoSgt(2026, 6, 5, 13, 30);
  return acceptedSlots[index % acceptedSlots.length];
}

function transportScheduleTime(item: WorkItem) {
  const appointment = typeof item.task.details?.appointmentDateTime === "string" ? item.task.details.appointmentDateTime : "";
  if (!appointment) return isoSgt(2026, 6, 6, 10, 0);
  const pickup = new Date(new Date(appointment).getTime() - 30 * 60_000);
  const hourSgt = new Date(pickup.getTime() + 8 * 3_600_000).getUTCHours();
  if (hourSgt < 9) return isoSgt(2026, 6, 6, 9, 0);
  return pickup.toISOString();
}

function outreachAssignee(index: number) {
  return ["Aisha Rahman", "Ben Tan", "Cheryl Lim", "Daniel Goh"][index % 4];
}

function transportAssignee(index: number) {
  return ["Wei Ming Tan", "Nora Lim", "Isaac Koh"][index % 3];
}

function visitModeFromWorkItem(it: WorkItem): ScheduleItem["visitMode"] {
  if (it.supportType === "transport") return undefined;
  const method = String(it.task.details?.checkMethod ?? "").toLowerCase();
  if (method.includes("home")) return "home";
  if (method.includes("video")) return "video";
  if (method.includes("phone") || method.includes("whatsapp") || method.includes("sms")) return "phone";
  return undefined;
}

function inventoryForWorkspace(items: WorkItem[], workspace: WorkspaceConfig): { rows: InventoryRow[]; locationHeader: string } {
  if (workspace.inventoryKind === "cooked-meals") {
    return { rows: cookedMealInventoryRows(items), locationHeader: "Fulfilment point" };
  }
  if (workspace.inventoryKind === "food-packs") {
    return { rows: foodPackInventoryRows(items), locationHeader: "Fulfilment point" };
  }
  if (workspace.inventoryKind === "public-supplies") {
    return { rows: publicSupplyInventoryRows(items, workspace), locationHeader: "Collection point" };
  }
  return { rows: [], locationHeader: "Collection point" };
}

function inventoryLocationHeader(workspace: WorkspaceConfig) {
  if (workspace.inventoryKind === "public-supplies") return "Collection point";
  return "Fulfilment point";
}

function inventoryTableKey(workspace: WorkspaceConfig, rows: InventoryRow[]) {
  return `${workspace.id}:${rows.map(inventoryRowSignature).join("|")}`;
}

function inventoryRowSignature(row: InventoryRow): string {
  return [
    row.id ?? row.item,
    row.available,
    row.reserved,
    row.fulfilled ?? 0,
    row.lastUpdated,
    ...(row.children ?? []).map(inventoryRowSignature),
  ].join(":");
}

function workItemTaskDbId(item: WorkItem): string | null {
  return (item.task as typeof item.task & { dbId?: string }).dbId ?? null;
}

function workItemRouteDbId(item: WorkItem): string | null {
  return (item.route as NonNullable<typeof item.route> & { dbId?: string } | undefined)?.dbId ?? null;
}

const PUBLIC_SUPPLY_STOCK = [
  { item: "Masks", available: 420, threshold: 120, collectionPoint: "Temasek distribution shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 10) },
  { item: "ART kits", available: 38, threshold: 40, collectionPoint: "MOH pickup shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 20) },
  { item: "Hand sanitiser", available: 75, threshold: 30, collectionPoint: "Temasek distribution shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 35) },
  { item: "Dengue kit / repellent pack", available: 1, threshold: 10, collectionPoint: "NEA outreach shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 45) },
] as const;

const MEAL_PERIODS = ["Lunch", "Dinner"] as const;
const DIETARY_VARIANTS = ["Regular", "Halal", "Vegetarian", "Soft food", "Low sugar", "Low salt", "Special"] as const;
type MealPeriod = typeof MEAL_PERIODS[number];
type DietaryVariant = typeof DIETARY_VARIANTS[number];

const COOKED_MEAL_STOCK: Record<MealPeriod, Record<DietaryVariant, { available: number; threshold: number; collectionPoint: string; lastUpdated: string }>> = {
  Lunch: {
    Regular: { available: 34, threshold: 10, collectionPoint: "Central meal kitchen", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Halal: { available: 14, threshold: 4, collectionPoint: "Halal meal shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Vegetarian: { available: 10, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Soft food": { available: 8, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Low sugar": { available: 7, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Low salt": { available: 9, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Special: { available: 5, threshold: 2, collectionPoint: "Special prep shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
  },
  Dinner: {
    Regular: { available: 30, threshold: 10, collectionPoint: "Central meal kitchen", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Halal: { available: 12, threshold: 4, collectionPoint: "Halal meal shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Vegetarian: { available: 9, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Soft food": { available: 7, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Low sugar": { available: 6, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    "Low salt": { available: 8, threshold: 3, collectionPoint: "Diet kitchen shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
    Special: { available: 5, threshold: 2, collectionPoint: "Special prep shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
  },
};

const FOOD_PACK_STOCK = [
  { item: "Standard food packs", available: 26, threshold: 10, collectionPoint: "Community pack store", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
  { item: "Fresh add-on packs", available: 7, threshold: 8, collectionPoint: "Fresh add-on shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 30) },
] as const;

function publicSupplyInventoryRows(items: WorkItem[], workspace: WorkspaceConfig): InventoryRow[] {
  const labels = new Set(workspace.supplyRouteLabels ?? []);
  return PUBLIC_SUPPLY_STOCK.filter((stock) => labels.has(stock.item)).map((stock) => {
    const movements = supplyMovementsForItem(items, stock.item);
    return inventoryRowFromMovements(stock, movements);
  });
}

function cookedMealInventoryRows(items: WorkItem[]): InventoryRow[] {
  return MEAL_PERIODS.map((meal) => {
    const children = DIETARY_VARIANTS.map((variant) => {
      const stock = COOKED_MEAL_STOCK[meal][variant];
      return inventoryRowFromMovements({
        item: variant,
        available: stock.available,
        threshold: stock.threshold,
        collectionPoint: stock.collectionPoint,
        lastUpdated: stock.lastUpdated,
      }, cookedMealMovementsForVariant(items, meal, variant), `${meal}:${variant}`);
    });
    return aggregateInventoryParent(meal, children);
  });
}

function foodPackInventoryRows(items: WorkItem[]): InventoryRow[] {
  return FOOD_PACK_STOCK.map((stock) => inventoryRowFromMovements(stock, foodPackMovementsForItem(items, stock.item)));
}

function inventoryRowFromMovements(
  stock: { item: string; available: number; threshold: number; collectionPoint: string; lastUpdated: string },
  movements: { quantity: number; status: RequestStatus; createdAt: string }[],
  id?: string
): InventoryRow {
  const fulfilled = movements.filter((m) => m.status === "Completed").reduce((sum, m) => sum + m.quantity, 0);
  const reserved = movements.filter((m) => isOpenRequestStatus(m.status)).reduce((sum, m) => sum + m.quantity, 0);
  const lastRequestMs = Math.max(0, ...movements.map((m) => new Date(m.createdAt).getTime()));
  const lastUpdated = lastRequestMs > new Date(stock.lastUpdated).getTime() ? new Date(lastRequestMs).toISOString() : stock.lastUpdated;
  const available = Math.max(0, stock.available - fulfilled);

  return {
    id,
    item: stock.item,
    available,
    reserved,
    collectionPoint: stock.collectionPoint,
    lastUpdated: formatInventoryDate(lastUpdated),
    status: inventoryStatus(available, stock.threshold),
    threshold: stock.threshold,
  };
}

function supplyMovementsForItem(items: WorkItem[], item: string) {
  return items.flatMap((it) => {
    if (it.kind !== "supplies-route" || it.route?.label !== item) return [];
    return [{
      quantity: Number(it.route.quantity ?? 0) || 0,
      status: it.status,
      createdAt: it.session.createdAt,
    }];
  });
}

function cookedMealMovementsForVariant(items: WorkItem[], meal: MealPeriod, variant: DietaryVariant) {
  return items.flatMap((it) => {
    if (it.kind !== "food-route" || it.route?.label !== "Cooked meals") return [];
    const portions = Number(it.task.details.portionsPerMeal ?? 1) || 1;
    const meals = Array.isArray(it.task.details.mealsNeeded) ? it.task.details.mealsNeeded.map(String) : [];
    if (!meals.includes(meal)) return [];
    if (mealDietaryVariant(it) !== variant) return [];
    return [{ quantity: portions, status: it.status, createdAt: it.session.createdAt }];
  });
}

function mealDietaryVariant(item: WorkItem): DietaryVariant {
  const restrictions = Array.isArray(item.task.details.dietaryRestrictions)
    ? item.task.details.dietaryRestrictions.map(String).filter(Boolean)
    : [];
  const other = String(item.task.details.dietaryRestrictionsOther ?? "").trim();
  if (!restrictions.length && !other) return "Regular";
  if (other || restrictions.includes("Other") || restrictions.length > 1) return "Special";
  const [restriction] = restrictions;
  if (DIETARY_VARIANTS.includes(restriction as DietaryVariant) && restriction !== "Special") return restriction as DietaryVariant;
  return "Special";
}

function aggregateInventoryParent(item: string, children: InventoryRow[]): InventoryRow {
  const available = children.reduce((sum, row) => sum + row.available, 0);
  const reserved = children.reduce((sum, row) => sum + row.reserved, 0);
  const threshold = children.reduce((sum, row) => sum + row.threshold, 0);
  return {
    id: `meal:${item}`,
    item,
    available,
    reserved,
    collectionPoint: "Meal prep shelves",
    lastUpdated: latestInventoryDisplayDate(children.map((row) => row.lastUpdated)),
    status: inventoryStatus(available, threshold),
    threshold,
    children,
  };
}

function foodPackMovementsForItem(items: WorkItem[], item: string) {
  return items.flatMap((it) => {
    if (it.kind !== "food-route" || it.route?.label !== "Food pack / rations") return [];
    const packType = String(it.task.details.packType ?? "Standard food pack / rations");
    const quantity = foodPackQuantity(it.task.details.numberOfPacks, it.task.details.numberOfPacksOther);
    if (item === "Standard food packs" && packType === "Standard food pack / rations") {
      return [{ quantity, status: it.status, createdAt: it.session.createdAt }];
    }
    if (item === "Fresh add-on packs" && packType === "Food pack with fresh add-ons, if available") {
      return [{ quantity, status: it.status, createdAt: it.session.createdAt }];
    }
    return [];
  });
}

function foodPackQuantity(value: unknown, other: unknown) {
  if (value === "2 packs") return 2;
  if (value === "Other") return Number(other ?? 1) || 1;
  return 1;
}

function isOpenRequestStatus(status: RequestStatus) {
  return status === "Pending" || status === "Accepted" || status === "In progress";
}

function inventoryStatus(available: number, threshold: number): InventoryStatus {
  if (available === 0) return "Out";
  if (available < threshold) return "Low";
  return "OK";
}

function formatInventoryDate(iso: string) {
  return new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function latestInventoryDisplayDate(values: string[]) {
  return values.reduce((latest, value) => {
    const latestMs = Date.parse(latest);
    const valueMs = Date.parse(value);
    if (!Number.isNaN(latestMs) && !Number.isNaN(valueMs)) return valueMs > latestMs ? value : latest;
    return latest;
  }, values[0] ?? "");
}

function isoSgt(y: number, m: number, d: number, h: number, min: number) {
  return new Date(Date.UTC(y, m - 1, d, h - 8, min, 0)).toISOString();
}

function applyStatus(sessions: RequestSession[], item: WorkItem, next: RequestStatus, reason?: string): RequestSession[] {
  return sessions.map((s) => {
    if (s.id !== item.sessionId) return s;
    const tasks = s.tasks.map((t) => {
      if (t.supportType !== item.supportType) return t;
      if (item.route) {
        const routes = (t.fulfilmentRoutes ?? []).map((r) =>
          r.label === item.route!.label ? { ...r, lifecycle: next } : r
        );
        const updatedTask = { ...t, fulfilmentRoutes: routes };
        return { ...updatedTask, status: taskStatus(updatedTask) };
      }
      return { ...t, status: next, ...(reason ? { rejectionReason: reason } : {}) };
    });
    return { ...s, tasks, overallStatus: rollupStatus(tasks.map(taskStatus)) };
  });
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`ops-card p-4 ${className}`}>{children}</section>;
}

function ClearRegionButton({ region, onClear }: { region: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
    >
      {region}
      <X size={12} />
    </button>
  );
}

function QueueActions({
  refreshing,
  showRefresh,
  regionFilter,
  onRefresh,
  onClearRegion,
}: {
  refreshing: boolean;
  showRefresh: boolean;
  regionFilter: string | null;
  onRefresh: () => void;
  onClearRegion: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh queue"
          title="Refresh queue"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      )}
      {regionFilter && <ClearRegionButton region={regionFilter} onClear={onClearRegion} />}
    </div>
  );
}

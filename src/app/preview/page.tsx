"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Inbox, X } from "lucide-react";
import type { FeatureCollection } from "geojson";
import StatusBadge from "@/components/kit/StatusBadge";
import OrgLogo from "@/components/kit/OrgLogo";
import EmptyState from "@/components/kit/EmptyState";
import CostChip from "@/components/kit/CostChip";
import RequestQueue from "@/components/kit/RequestQueue";
import InventoryTable, { type InventoryRow, type InventoryStatus } from "@/components/kit/InventoryTable";
import Modal from "@/components/kit/Modal";
import ConfirmDialog from "@/components/kit/ConfirmDialog";
import SlideOver from "@/components/kit/SlideOver";
import ScheduleBoard, { type ScheduleItem } from "@/components/kit/ScheduleBoard";
import ScheduleDetailPanel from "@/components/kit/ScheduleDetailPanel";
import AnalyticsPanel from "@/components/kit/AnalyticsPanel";
import RequestDetailPanel from "@/components/kit/RequestDetailPanel";
import { pickColumns, ALL_COLUMN_KEYS } from "@/components/kit/columns";
import { deriveUrgency } from "@/components/kit/format";
import { REQUEST_STATUSES, URGENCY_STYLES, type UrgencyTier } from "@/components/kit/theme";
import { TRANSITIONS, flattenToWorkItems, supportTypeLabels, type RequestStatus, type WorkItem } from "@/lib/contract";
import { generateSessions, countByArea } from "@/lib/mock";
import { cn } from "@/lib/utils";

// Leaflet needs `window` — load the map client-only.
const MapHeatmap = dynamic(() => import("@/components/kit/MapHeatmap"), { ssr: false });

const SOURCE_ITEMS = flattenToWorkItems(generateSessions());
const ALL_COLUMNS = pickColumns(ALL_COLUMN_KEYS.filter((key) => key !== "type"));

// Preview needs enough geographical/date spread to exercise the components, but
// it must still behave like production wiring: one canonical WorkItem stream
// feeds the request queue, analytics, map counts, and map drill-down rows.
const PREVIEW_AREA_SPREAD = [
  "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio", "Ang Mo Kio",
  "Bedok", "Bedok", "Bedok", "Bedok", "Bedok", "Bedok", "Bedok",
  "Tampines", "Tampines", "Tampines", "Tampines", "Tampines", "Tampines",
  "Yishun", "Yishun", "Yishun", "Yishun", "Yishun",
  "Toa Payoh", "Toa Payoh", "Toa Payoh", "Toa Payoh",
  "Queenstown", "Queenstown", "Queenstown",
  "Jurong West", "Jurong West",
  "Hougang", "Hougang",
  "Bishan",
  "Woodlands",
];

const PREVIEW_SCHEDULE: Record<string, PreviewScheduleSeed> = {
  "req-010:referral": {
    submittedAt: isoSgt(2026, 6, 3, 14, 20),
    scheduledFor: isoSgt(2026, 6, 4, 15, 0),
    assignedTo: "Aisha Rahman",
    dispatchMethod: "Video call",
    status: "Completed",
  },
  "req-022:referral": {
    submittedAt: isoSgt(2026, 6, 4, 10, 10),
    scheduledFor: isoSgt(2026, 6, 5, 13, 30),
    assignedTo: "Cheryl Lim",
    dispatchMethod: "Video call",
    status: "Accepted",
  },
  "req-009:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 8, 40),
    scheduledFor: isoSgt(2026, 6, 5, 9, 15),
    assignedTo: "Aisha Rahman",
    dispatchMethod: "Home visit",
    status: "Completed",
  },
  "req-011:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 9, 5),
    scheduledFor: isoSgt(2026, 6, 5, 10, 30),
    assignedTo: "Ben Tan",
    dispatchMethod: "Home visit",
    status: "In progress",
  },
  "req-008:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 10, 20),
    scheduledFor: isoSgt(2026, 6, 6, 9, 30),
    assignedTo: "Cheryl Lim",
    dispatchMethod: "Home visit",
    status: "Accepted",
  },
  "req-023:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 12, 15),
    scheduledFor: isoSgt(2026, 6, 6, 11, 0),
    assignedTo: "Daniel Goh",
    dispatchMethod: "Home visit",
    status: "Accepted",
  },
  "req-030:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 13, 0),
    scheduledFor: isoSgt(2026, 6, 6, 12, 15),
    assignedTo: "Ben Tan",
    dispatchMethod: "Home visit",
    status: "Accepted",
  },
  "req-012:referral": {
    submittedAt: isoSgt(2026, 6, 4, 11, 10),
    scheduledFor: isoSgt(2026, 6, 6, 15, 0),
    assignedTo: "Cheryl Lim",
    dispatchMethod: "Video call",
    status: "Accepted",
  },
  "req-033:welfare": {
    submittedAt: isoSgt(2026, 6, 5, 14, 20),
    scheduledFor: isoSgt(2026, 6, 6, 16, 15),
    assignedTo: "Daniel Goh",
    dispatchMethod: "Home visit",
    status: "Accepted",
  },
};

const RAW_PREVIEW_ITEMS = SOURCE_ITEMS.map((it, i) => {
  const w = i % 6;
  const ms = Date.UTC(2026, 5, 5) - (5 - w) * 7 * 86_400_000 - (i % 5) * 86_400_000 + (1 + (i % 9)) * 3_600_000;
  return {
    ...it,
    session: {
      ...it.session,
      generalArea: PREVIEW_AREA_SPREAD[i % PREVIEW_AREA_SPREAD.length],
      createdAt: new Date(ms).toISOString(),
    },
  };
});
const PREVIEW_ITEMS = applyPreviewScheduleFields(RAW_PREVIEW_ITEMS);

const AREA_COUNTS = countByArea(PREVIEW_ITEMS).map((a) => ({ region: a.area, count: a.count }));
assertAreaCountsMatchQueue(PREVIEW_ITEMS, AREA_COUNTS);

// Compact column set for the area drill-down queue (area is uniform → dropped).
const DRILL_COLUMNS = pickColumns(["id", "submittedBy", "detail", "priority", "neededBy", "status"]);
const CAREGIVER_SUPPLY_ITEMS = ["Masks", "ART kits", "Hand sanitiser", "Dengue kit / repellent pack"] as const;
const SUPPLY_INVENTORY: SupplyInventorySeed[] = [
  { item: "Masks", available: 420, threshold: 120, collectionPoint: "AMK CC Store", lastUpdated: isoSgt(2026, 6, 5, 8, 10) },
  { item: "ART kits", available: 38, threshold: 40, collectionPoint: "MOH pickup shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 20) },
  { item: "Hand sanitiser", available: 12, threshold: 20, collectionPoint: "Bedok community store", lastUpdated: isoSgt(2026, 6, 5, 8, 35) },
  { item: "Dengue kit / repellent pack", available: 1, threshold: 10, collectionPoint: "NEA outreach shelf", lastUpdated: isoSgt(2026, 6, 5, 8, 45) },
];
const SCHEDULE_ITEMS = scheduleItemsFromWorkItems(PREVIEW_ITEMS);
assertScheduleItemsMatchQueue(PREVIEW_ITEMS, SCHEDULE_ITEMS);
assertScheduleTimelineCoherent(PREVIEW_ITEMS);
const INVENTORY_ROWS = inventoryRowsFromWorkItems(PREVIEW_ITEMS);
assertInventoryItemsMatchCaregiverSupplyItems(INVENTORY_ROWS);
const REGION_DRAWER_MIN_WIDTH = 760;
const REGION_DRAWER_DEFAULT_WIDTH = 980;
const REGION_DRAWER_MAX_WIDTH = 1160;
const DETAIL_DRAWER_WIDTH = 500;
const OVERLAY_GAP = 16;

// Kitchen-sink harness for the ORCA partner-dashboard kit. Renders each kit
// piece in isolation. Today: design layer + leaf primitives. Data-driven
// components (RequestQueue, RequestDetailPanel, KPIStrip, …) land on top of the
// shared contract once contract.ts is in.
export default function PreviewPage() {
  const urgencies = Object.keys(URGENCY_STYLES) as UrgencyTier[];
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResult, setConfirmResult] = useState<string | null>(null);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<WorkItem | null>(null);
  const [regionDrawerWidth, setRegionDrawerWidth] = useState(REGION_DRAWER_DEFAULT_WIDTH);
  const effectiveRegionDrawerWidth = clampRegionDrawerWidth(regionDrawerWidth, Boolean(selectedItem));
  const regionItems = region ? PREVIEW_ITEMS.filter((it) => it.session.generalArea === region) : [];

  useEffect(() => {
    fetch("/sg-planning-areas.json")
      .then((r) => r.json())
      .then((g: FeatureCollection) => setGeojson(g))
      .catch(() => setGeojson(null));
  }, []);

  function handleRegionResizeStart(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const update = (clientX: number) => {
      setRegionDrawerWidth(clampRegionDrawerWidth(clientX, Boolean(selectedItem)));
    };
    update(e.clientX);

    const onMove = (event: MouseEvent) => update(event.clientX);
    const onUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-lg font-semibold text-slate-800">ORCA Kit — Preview</h1>
          <p className="text-sm text-slate-500">
            Owned design layer + leaf primitives. Data-driven components compose onto the shared contract.
          </p>
        </header>

        <Section title="RequestQueue — full column superset (all columns shown)">
          <RequestQueue
            items={PREVIEW_ITEMS}
            columns={ALL_COLUMNS}
            selectedId={selectedItem?.id}
            onSelect={setSelectedItem}
            showAllColumns
            defaultSortKey="submitted"
            defaultSortDir="desc"
            statusTabs
            todoEmptyTitle="Nothing to do right now"
            todoEmptyHint="Open requests from the shared WorkItem stream appear here."
            closedEmptyTitle="No closed requests"
            closedEmptyHint="Completed, cancelled, and rejected requests appear here."
          />
        </Section>

        <Section title="AnalyticsPanel — period-scoped (week / month, navigable)">
          <AnalyticsPanel items={PREVIEW_ITEMS} />
        </Section>

        <Section title="MapHeatmap — request density by planning area (click a district)">
          {geojson ? (
            <MapHeatmap
              data={AREA_COUNTS}
              geojson={geojson}
              onRegionClick={(nextRegion) => {
                setRegion(nextRegion);
                setSelectedItem(null);
                setSelectedScheduleItem(null);
              }}
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-400">
              Loading map…
            </div>
          )}
        </Section>

        <Section title="ScheduleBoard — weekly dispatch calendar (time · assignee lanes)">
          <ScheduleBoard
            items={SCHEDULE_ITEMS}
            onSelect={(id) => {
              const item = PREVIEW_ITEMS.find((it) => it.id === id);
              if (item) {
                setSelectedItem(null);
                setSelectedScheduleItem(item);
              }
            }}
          />
        </Section>

        <Section title="InventoryTable — supply stock operations">
          <InventoryTable rows={INVENTORY_ROWS} />
        </Section>

        <Section title="Modal / SlideOver + ConfirmDialog">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setModalOpen(true)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
              Open slide-over (right)
            </button>
            <button onClick={() => setConfirmOpen(true)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
              Open confirm (destructive)
            </button>
            {confirmResult && <span className="text-xs text-slate-500">Last action: {confirmResult}</span>}
          </div>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} side="right">
            <div className="ops-card flex h-full flex-col p-5">
              <h3 className="text-sm font-semibold text-slate-800">Slide-over shell</h3>
              <p className="mt-1.5 text-sm text-slate-500">The request detail panel renders inside this. Click the backdrop or press Esc to close.</p>
            </div>
          </Modal>
          <ConfirmDialog
            open={confirmOpen}
            title="Reject this request?"
            confirmLabel="Reject"
            destructive
            onConfirm={() => { setConfirmResult("confirmed"); setConfirmOpen(false); }}
            onCancel={() => { setConfirmResult("cancelled"); setConfirmOpen(false); }}
          />
        </Section>

        <Section title="StatusBadge — canonical 6 states">
          <div className="flex flex-wrap gap-2">
            {REQUEST_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
            <StatusBadge status="Unknown" />
          </div>
        </Section>

        <Section title="Urgency tiers — derived from neededBy">
          <div className="flex flex-wrap gap-2">
            {urgencies.map((u) => (
              <span
                key={u}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
                  URGENCY_STYLES[u].pill
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", URGENCY_STYLES[u].dot)} />
                {u}
              </span>
            ))}
          </div>
        </Section>

        <Section title="CostChip">
          <div className="flex flex-wrap gap-2">
            <CostChip text="Free" tone="free" />
            <CostChip text="$4.90–$7.00 / meal" tone="estimated" />
            <CostChip text="$12.00" tone="fixed" />
            <CostChip text="Partner assessment" tone="review" />
          </div>
        </Section>

        <Section title="OrgLogo — square logo with letter fallback">
          <div className="flex flex-wrap items-center gap-3">
            <OrgLogo name="Allkin Singapore" />
            <OrgLogo name="Care Corner" />
            <OrgLogo name="TOUCH Meals on Wheels" size={36} />
            <OrgLogo name="Food from the Heart" size={36} />
          </div>
        </Section>

        <Section title="EmptyState">
          <div className="ops-card">
            <EmptyState
              title="No requests in this queue"
              hint="Routed requests appear here as caregivers submit them."
              icon={<Inbox size={28} />}
            />
          </div>
        </Section>
      </div>

      {/* Map drill-down: clicking a district slides out its request queue. */}
      <SlideOver open={!!region} onClose={() => setRegion(null)} side="left" width={effectiveRegionDrawerWidth}>
        <div className="ops-card relative flex h-full flex-col">
          <button
            type="button"
            onMouseDown={handleRegionResizeStart}
            className="absolute right-0 top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center rounded-r-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Resize area request queue"
            aria-orientation="vertical"
            role="separator"
          >
            <span className="h-20 w-1 rounded-full bg-slate-300 opacity-0 transition-opacity hover:opacity-100" />
          </button>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{region}</h3>
              <p className="text-xs text-slate-400">{regionItems.length} request{regionItems.length === 1 ? "" : "s"} in this area</p>
            </div>
            <button onClick={() => setRegion(null)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <RequestQueue
              items={regionItems}
              columns={DRILL_COLUMNS}
              selectedId={selectedItem?.id}
              onSelect={(item) => {
                setSelectedScheduleItem(null);
                setSelectedItem(item);
              }}
              defaultSortKey="submitted"
              defaultSortDir="desc"
              emptyTitle={`No requests in ${region ?? "this area"}`}
              emptyHint="Districts shaded on the map have active requests."
            />
          </div>
        </div>
      </SlideOver>

      <SlideOver open={!!selectedScheduleItem} onClose={() => setSelectedScheduleItem(null)} width={DETAIL_DRAWER_WIDTH} backdrop={!region}>
        {selectedScheduleItem && (
          <ScheduleDetailPanel
            item={selectedScheduleItem}
            onClose={() => setSelectedScheduleItem(null)}
          />
        )}
      </SlideOver>

      <SlideOver open={!!selectedItem} onClose={() => setSelectedItem(null)} width={DETAIL_DRAWER_WIDTH} backdrop={!region && !selectedScheduleItem}>
        {selectedItem && (
          <RequestDetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

function clampRegionDrawerWidth(width: number, hasDetail: boolean) {
  if (typeof window === "undefined") return width;
  const maxByViewport = window.innerWidth - (hasDetail ? DETAIL_DRAWER_WIDTH + OVERLAY_GAP : OVERLAY_GAP);
  const max = Math.max(REGION_DRAWER_MIN_WIDTH, Math.min(REGION_DRAWER_MAX_WIDTH, maxByViewport));
  return Math.min(max, Math.max(REGION_DRAWER_MIN_WIDTH, width));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ops-card p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function assertAreaCountsMatchQueue(items: WorkItem[], areas: { region: string; count: number }[]) {
  if (process.env.NODE_ENV === "production") return;
  const queueCounts = new Map(countByArea(items).map((a) => [a.area, a.count]));
  const mapCounts = new Map(areas.map((a) => [a.region, a.count]));
  const keys = new Set([...queueCounts.keys(), ...mapCounts.keys()]);
  for (const key of keys) {
    if ((queueCounts.get(key) ?? 0) !== (mapCounts.get(key) ?? 0)) {
      throw new Error(`Preview data mismatch for ${key}: queue=${queueCounts.get(key) ?? 0}, map=${mapCounts.get(key) ?? 0}`);
    }
  }
}

type PreviewScheduleSeed = {
  submittedAt: string;
  scheduledFor: string;
  assignedTo: string;
  dispatchMethod: "Home visit" | "Video call";
  status: Extract<RequestStatus, "Accepted" | "In progress" | "Completed">;
};

function isoSgt(y: number, m: number, d: number, h: number, min: number) {
  return new Date(Date.UTC(y, m - 1, d, h - 8, min, 0)).toISOString();
}

function applyPreviewScheduleFields(items: WorkItem[]): WorkItem[] {
  return items.map((it) => {
    const seed = PREVIEW_SCHEDULE[it.id];
    if (!seed) return it;

    const task = {
      ...it.task,
      details: { ...it.task.details, checkMethod: seed.dispatchMethod },
      assignedTo: seed.assignedTo,
      scheduledFor: seed.scheduledFor,
      status: seed.status,
    };
    const route = it.route ? { ...it.route, lifecycle: seed.status } : undefined;

    return {
      ...it,
      status: seed.status,
      transitions: TRANSITIONS.full[seed.status],
      task,
      ...(route ? { route } : {}),
      session: {
        ...it.session,
        createdAt: seed.submittedAt,
        overallStatus: seed.status,
      },
    };
  });
}

function assertScheduleItemsMatchQueue(items: WorkItem[], schedule: ScheduleItem[]) {
  if (process.env.NODE_ENV === "production") return;
  const scheduledItems = items.filter((it) => it.task.scheduledFor);
  const scheduledById = new Map(schedule.map((it) => [it.id, it]));
  for (const it of scheduledItems) {
    const scheduled = scheduledById.get(it.id);
    if (!scheduled) throw new Error(`Scheduled request missing from ScheduleBoard: ${it.id}`);
    if (scheduled.when !== it.task.scheduledFor) throw new Error(`Schedule time mismatch for ${it.id}`);
    if (scheduled.assignee !== (it.task.assignedTo?.trim() || "Unassigned")) throw new Error(`Schedule assignee mismatch for ${it.id}`);
    if (!["Accepted", "In progress", "Completed"].includes(it.status)) throw new Error(`Invalid scheduled status for ${it.id}: ${it.status}`);
  }
}

function assertScheduleTimelineCoherent(items: WorkItem[]) {
  if (process.env.NODE_ENV === "production") return;
  const scheduled = items
    .filter((it) => it.task.scheduledFor)
    .sort((a, b) => new Date(a.task.scheduledFor ?? 0).getTime() - new Date(b.task.scheduledFor ?? 0).getTime());
  const active = scheduled.filter((it) => it.status === "In progress");
  if (active.length > 1) throw new Error(`Preview schedule has ${active.length} in-progress items`);
  if (active.length === 0) return;

  const activeMs = new Date(active[0].task.scheduledFor ?? 0).getTime();
  const earlierOpen = scheduled.filter((it) => new Date(it.task.scheduledFor ?? 0).getTime() < activeMs && it.status !== "Completed");
  if (earlierOpen.length > 0) {
    throw new Error(`Earlier scheduled items must be completed before active slot: ${earlierOpen.map((it) => it.id).join(", ")}`);
  }
}

type SupplyInventorySeed = {
  item: (typeof CAREGIVER_SUPPLY_ITEMS)[number];
  available: number;
  threshold: number;
  collectionPoint: string;
  lastUpdated: string;
};

function inventoryRowsFromWorkItems(items: WorkItem[]): InventoryRow[] {
  return SUPPLY_INVENTORY.map((stock) => {
    const movements = supplyMovementsForItem(items, stock.item);
    const fulfilled = movements
      .filter((m) => m.status === "Completed")
      .reduce((sum, m) => sum + m.quantity, 0);
    const reserved = movements
      .filter((m) => m.status === "Pending" || m.status === "Accepted" || m.status === "In progress")
      .reduce((sum, m) => sum + m.quantity, 0);
    const lastRequestMs = Math.max(0, ...movements.map((m) => new Date(m.createdAt).getTime()));
    const lastUpdated = lastRequestMs > new Date(stock.lastUpdated).getTime() ? new Date(lastRequestMs).toISOString() : stock.lastUpdated;
    const available = Math.max(0, stock.available - fulfilled);

    return {
      item: stock.item,
      available,
      reserved,
      collectionPoint: stock.collectionPoint,
      lastUpdated: formatInventoryDate(lastUpdated),
      status: inventoryStatus(available, stock.threshold),
      threshold: stock.threshold,
    };
  });
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

function inventoryStatus(available: number, threshold: number): InventoryStatus {
  if (available === 0) return "Out";
  if (available < threshold) return "Low";
  return "OK";
}

function formatInventoryDate(iso: string) {
  return new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function assertInventoryItemsMatchCaregiverSupplyItems(rows: InventoryRow[]) {
  if (process.env.NODE_ENV === "production") return;
  const expected = new Set<string>(CAREGIVER_SUPPLY_ITEMS);
  const actual = new Set(rows.map((row) => row.item));
  for (const item of expected) {
    if (!actual.has(item)) throw new Error(`Inventory missing caregiver supply item: ${item}`);
  }
  for (const item of actual) {
    if (!expected.has(item)) throw new Error(`Inventory contains non-caregiver supply item: ${item}`);
  }
}

function scheduleItemsFromWorkItems(items: WorkItem[]): ScheduleItem[] {
  return items
    .filter((it) => it.task.scheduledFor && ["Accepted", "In progress", "Completed"].includes(it.status))
    .sort((a, b) => new Date(a.task.scheduledFor ?? 0).getTime() - new Date(b.task.scheduledFor ?? 0).getTime())
    .map((it) => {
      const type = it.route?.label ?? supportTypeLabels[it.supportType];
      return {
        id: it.id,
        title: `${type} · ${it.session.careRecipientName}`,
        when: it.task.scheduledFor ?? "",
        meta: `${it.session.generalArea ?? "Unknown area"} · ${it.status}`,
        assignee: it.task.assignedTo?.trim() || "Unassigned",
        status: it.status,
        scheduleStatus: it.status === "In progress" ? "In progress" : it.status === "Completed" ? "Completed" : "Scheduled",
        visitMode: visitModeFromWorkItem(it),
        priority: deriveUrgency(it.task, it.session.createdAt),
        kind: it.supportType,
      };
    });
}

function visitModeFromWorkItem(it: WorkItem): ScheduleItem["visitMode"] {
  const method = String(it.task.details?.checkMethod ?? "").toLowerCase();
  if (method.includes("home")) return "home";
  if (method.includes("video")) return "video";
  return undefined;
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import type { FeatureCollection } from "geojson";
import RequestQueue from "@/components/kit/RequestQueue";
import RequestDetailPanel from "@/components/kit/RequestDetailPanel";
import SlideOver from "@/components/kit/SlideOver";
import AnalyticsPanel from "@/components/kit/AnalyticsPanel";
import OrgLogo from "@/components/kit/OrgLogo";
import ScheduleBoard, { type PreferredScheduleSlot, type ScheduleItem, type SchedulePlacement } from "@/components/kit/ScheduleBoard";
import ScheduleDetailPanel from "@/components/kit/ScheduleDetailPanel";
import InventoryTable, { type InventoryRow, type InventoryStatus } from "@/components/kit/InventoryTable";
import { pickColumns } from "@/components/kit/columns";
import { deriveUrgency } from "@/components/kit/format";
import {
  checkpointLabel,
  routeCheckpointStages,
  TRANSITIONS,
  flattenToWorkItems,
  rollupStatus,
  supportTypeLabels,
  taskStatus,
  type FulfilmentCheckpointStage,
  type RequestSession,
  type RequestStatus,
  type WorkItem,
} from "@/lib/contract";
import { countByArea, generateSessions } from "@/lib/mock";
import type { DashboardScheduleAssignment, ScheduleAssignmentMutationResult, ScheduleStatus } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { assigneesForWorkspace, type WorkspaceConfig } from "@/lib/workspaces";
import {
  advanceRouteCheckpointAction,
  updateInventoryStockAction,
  updateScheduleAssignmentDetailsAction,
  updateScheduleAssignmentStatusAction,
  updateWorkItemStatusAction,
} from "@/app/actions";

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

type PendingRequestStatusAction = {
  item: WorkItem;
  next: RequestStatus;
  reason?: string;
};

type PendingScheduleStatusAction = {
  item: ScheduledWorkItem;
  next: ScheduleStatus;
};

export default function WorkspaceDashboard({ workspace, initialSessions, initialInventoryRows, initialScheduleAssignments }: Props) {
  const router = useRouter();
  const liveData = initialSessions !== undefined;
  const [isRefreshing, startRefreshTransition] = useTransition();
  const scheduleSectionRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<RequestSession[]>(() => initialSessions ?? generateSessions());
  const [scheduleAssignmentOverrides, setScheduleAssignmentOverrides] = useState<DashboardScheduleAssignment[] | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItemSnapshot, setSelectedItemSnapshot] = useState<WorkItem | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<SchedulePlacement | null>(null);
  const [acceptPlacementItem, setAcceptPlacementItem] = useState<WorkItem | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [pendingRequestStatus, setPendingRequestStatus] = useState<PendingRequestStatusAction | null>(null);
  const [pendingScheduleStatus, setPendingScheduleStatus] = useState<PendingScheduleStatusAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const scheduleAssignments = scheduleAssignmentOverrides ?? initialScheduleAssignments;

  const allItems = useMemo(() => itemsForWorkspace(sessions, workspace), [sessions, workspace]);
  const scheduledItems = useMemo<ScheduledWorkItem[]>(
    () => scheduleAssignments !== undefined
      ? scheduledWorkItemsFromAssignments(allItems, scheduleAssignments ?? [])
      : scheduledWorkItemsForWorkspace(allItems, workspace),
    [allItems, scheduleAssignments, workspace]
  );
  const baseScheduleItems = useMemo(() => scheduleItemsFromWorkItems(scheduledItems), [scheduledItems]);
  const acceptDraftScheduleItem = useMemo(
    () => acceptPlacementItem && placement?.itemId === acceptPlacementId(acceptPlacementItem)
      ? scheduleItemFromAcceptPlacement(acceptPlacementItem, placement)
      : null,
    [acceptPlacementItem, placement]
  );
  const scheduleItems = useMemo(
    () => acceptDraftScheduleItem ? [...baseScheduleItems, acceptDraftScheduleItem] : baseScheduleItems,
    [acceptDraftScheduleItem, baseScheduleItems]
  );
  const availableAssignees = useMemo(
    () => placement ? availableAssigneesForSlot(workspace, scheduleItems, placement) : [],
    [placement, scheduleItems, workspace]
  );
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

  const selectedLiveItem = allItems.find((i) => i.id === selectedId) ?? null;
  const selected = selectedLiveItem ?? (selectedItemSnapshot?.id === selectedId ? selectedItemSnapshot : null);
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

  function openRequestDetail(item: WorkItem) {
    setSelectedId(item.id);
    setSelectedItemSnapshot(item);
  }

  function closeRequestDetail() {
    setSelectedId(null);
    setSelectedItemSnapshot(null);
  }

  function closeAllDetails() {
    closeRequestDetail();
    setSelectedScheduleId(null);
  }

  function handleStatusChange(item: WorkItem, next: RequestStatus, reason?: string) {
    if (next === "Accepted") {
      if (workspace.scheduleKind) {
        beginAcceptPlacement(item);
        return;
      }
      void commitRequestStatusChange({ item, next, reason });
      return;
    }

    setPendingRequestStatus({ item, next, reason });
  }

  async function handleAdvanceCheckpoint(item: WorkItem, stage: FulfilmentCheckpointStage) {
    const routeId = workItemRouteDbId(item);
    if (!item.route || !routeId) return;
    setActionBusy(true);

    if (!liveData) {
      setSessions((prev) => applyRouteCheckpoint(prev, item, stage, new Date().toISOString(), workspace.shortName));
      setActionBusy(false);
      return;
    }

    const result = await advanceRouteCheckpointAction({
      workspaceSlug: workspace.slug,
      routeId,
      stage,
    });

    if (!result.ok) {
      console.warn("Failed to advance route checkpoint", result.error);
      setActionBusy(false);
      return;
    }
    if (!result.checkpoint) {
      console.warn("Route checkpoint action completed without a checkpoint payload");
      setActionBusy(false);
      return;
    }

    setSessions((prev) => applyRouteCheckpoint(
      prev,
      item,
      result.checkpoint.stage,
      result.checkpoint.completedAt,
      result.checkpoint.actorName
    ));
    setActionBusy(false);
  }

  function beginAcceptPlacement(item: WorkItem) {
    const scheduledFor = firstAvailablePlacementIso(preferredSlotForWorkItem(item)?.iso ?? defaultPlacementIso(), scheduleItems);
    setAcceptPlacementItem(item);
    setPlacementError(null);
    setPlacement({
      itemId: acceptPlacementId(item),
      scheduledFor,
    });
    setAssigneePickerOpen(false);
    closeRequestDetail();
    setSelectedScheduleId(null);
    requestAnimationFrame(() => {
      scheduleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateLocalScheduleAssignments(
    updater: (assignments: DashboardScheduleAssignment[] | null | undefined) => DashboardScheduleAssignment[] | null | undefined
  ) {
    setScheduleAssignmentOverrides((current) => updater(current ?? initialScheduleAssignments));
  }

  async function confirmRequestStatusChange() {
    const pending = pendingRequestStatus;
    if (!pending) return;
    await commitRequestStatusChange(pending);
  }

  async function commitRequestStatusChange(
    pending: PendingRequestStatusAction,
    scheduleDetails?: { assigneeName?: string; scheduledFor: string; notes?: string }
  ): Promise<boolean> {
    setActionBusy(true);

    if (!liveData) {
      const displayStatus = pending.next === "Accepted" && workspace.scheduleKind ? "In progress" : pending.next;
      setSessions((prev) => applyStatus(prev, pending.item, displayStatus, pending.reason, scheduleDetails));
      setPendingRequestStatus(null);
      setActionBusy(false);
      return true;
    }

    const result = await updateWorkItemStatusAction({
      workspaceSlug: workspace.slug,
      taskId: pending.item.route ? null : workItemTaskDbId(pending.item),
      routeId: pending.item.route ? workItemRouteDbId(pending.item) : null,
      next: pending.next,
      reason: pending.reason,
      scheduleDetails,
    });

    if (!result.ok) {
      const error = result.error ?? "Unable to update request status";
      if (scheduleDetails) {
        setPlacementError(error);
      } else {
        console.warn("Failed to update request status", error);
      }
      setActionBusy(false);
      return false;
    }

    if (result.rerouted) {
      setSessions((prev) => applyTaskReroute(prev, pending.item, pending.reason));
      setPendingRequestStatus(null);
      closeRequestDetail();
      setActionBusy(false);
      return true;
    }

    const displayStatus = pending.next === "Accepted" && result.scheduleAssignment ? "In progress" : pending.next;
    setSessions((prev) => applyStatus(
      prev,
      pending.item,
      displayStatus,
      pending.reason,
      result.scheduleAssignment
        ? {
            assigneeName: result.scheduleAssignment.assigneeName,
            scheduledFor: result.scheduleAssignment.scheduledFor,
            notes: result.scheduleAssignment.notes,
          }
        : scheduleDetails
    ));

    if (result.scheduleAssignment) {
      const assignment = scheduleAssignmentFromMutation(pending.item, workspace, result.scheduleAssignment);
      updateLocalScheduleAssignments((prev) => upsertScheduleAssignment(prev, assignment));
      setSelectedScheduleId(null);
    }

    setPendingRequestStatus(null);
    setActionBusy(false);
    return true;
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
      console.warn("Failed to update inventory stock", result.error);
      return;
    }

    router.refresh();
  }

  function handleScheduleStatusChange(item: ScheduledWorkItem, next: ScheduleStatus) {
    setPendingScheduleStatus({ item, next });
  }

  async function confirmScheduleStatusChange() {
    const pending = pendingScheduleStatus;
    if (!pending) return;
    const assignmentId = pending.item.scheduleAssignment?.id;
    if (!assignmentId) return;

    setActionBusy(true);
    const requestStatus = requestStatusFromScheduleStatus(pending.next);

    if (!liveData) {
      updateLocalScheduleAssignments((prev) => updateScheduleAssignmentStatus(prev, assignmentId, pending.next));
      if (requestStatus) setSessions((prev) => applyStatus(prev, pending.item, requestStatus));
      setPendingScheduleStatus(null);
      setActionBusy(false);
      return;
    }

    const result = await updateScheduleAssignmentStatusAction({
      workspaceSlug: workspace.slug,
      scheduleAssignmentId: assignmentId,
      next: pending.next,
    });

    if (!result.ok) {
      console.warn("Failed to update schedule assignment", result.error);
      setActionBusy(false);
      return;
    }

    updateLocalScheduleAssignments((prev) => updateScheduleAssignmentStatus(prev, assignmentId, pending.next));
    if (requestStatus) setSessions((prev) => applyStatus(prev, pending.item, requestStatus));
    setPendingScheduleStatus(null);
    setActionBusy(false);
  }

  function handleEditTimeslot(item: ScheduledWorkItem) {
    if (!item.scheduleAssignment) return;
    setPlacementError(null);
    setPlacement({
      itemId: item.id,
      scheduledFor: item.scheduleAssignment.scheduledFor,
      assignee: item.scheduleAssignment.assigneeName,
    });
    setSelectedScheduleId(null);
  }

  function handlePlaceTimeslot(iso: string) {
    setPlacementError(null);
    setPlacement((current) => current ? { ...current, scheduledFor: iso } : current);
  }

  async function handleConfirmPlacement() {
    if (!placement) return;
    const assignee = placement.assignee?.trim();
    if (!assignee) {
      setPlacementError("Assignee is required");
      setAssigneePickerOpen(true);
      return;
    }

    const validationError = validateSchedulePlacementClient(scheduleItems, placement, assignee);
    if (validationError) {
      setPlacementError(validationError);
      return;
    }
    setPlacementError(null);

    if (acceptPlacementItem && placement.itemId === acceptPlacementId(acceptPlacementItem)) {
      const details = {
        assigneeName: assignee,
        scheduledFor: placement.scheduledFor,
      };
      const ok = await commitRequestStatusChange({ item: acceptPlacementItem, next: "Accepted" }, details);
      if (!ok) return;
      setAcceptPlacementItem(null);
      setPlacement(null);
      setPlacementError(null);
      setAssigneePickerOpen(false);
      return;
    }

    const item = scheduledItems.find((candidate) => candidate.id === placement.itemId);
    if (!item) return;
    const assignmentId = item.scheduleAssignment?.id;
    if (!assignmentId) return;
    const details = {
      assigneeName: assignee,
      scheduledFor: placement.scheduledFor,
      notes: item.scheduleAssignment?.notes,
    };

    if (!liveData) {
      updateLocalScheduleAssignments((prev) => updateScheduleAssignmentDetails(prev, assignmentId, details));
      setSessions((prev) => applyScheduleDetails(prev, item, details, scheduledChangedStatus(item.scheduleAssignment?.scheduledFor, details.scheduledFor)));
      setPlacement(null);
      setPlacementError(null);
      setAssigneePickerOpen(false);
      return;
    }

    const result = await updateScheduleAssignmentDetailsAction({
      workspaceSlug: workspace.slug,
      scheduleAssignmentId: assignmentId,
      ...details,
    });

    if (!result.ok) {
      setPlacementError(result.error ?? "Unable to update schedule assignment");
      return;
    }

    updateLocalScheduleAssignments((prev) => updateScheduleAssignmentDetails(prev, assignmentId, details));
    setSessions((prev) => applyScheduleDetails(prev, item, details, scheduledChangedStatus(item.scheduleAssignment?.scheduledFor, details.scheduledFor)));
    setPlacement(null);
    setPlacementError(null);
    setAssigneePickerOpen(false);
  }

  function handleCancelPlacement() {
    setPlacement(null);
    setAcceptPlacementItem(null);
    setPlacementError(null);
    setAssigneePickerOpen(false);
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
                    onSelect={openRequestDetail}
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
                        closeAllDetails();
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
              <div ref={scheduleSectionRef}>
                <Section>
                  <ScheduleBoard
                    items={scheduleItems}
                    placement={placement}
                    placementError={placementError}
                    onSelect={(id) => {
                      closeRequestDetail();
                      setSelectedScheduleId(id);
                    }}
                    onPlaceTimeslot={handlePlaceTimeslot}
                    onConfirmPlacement={handleConfirmPlacement}
                    onChooseAssignee={() => setAssigneePickerOpen(true)}
                    onCancelPlacement={handleCancelPlacement}
                  />
                </Section>
              </div>
            )}
          </div>
        </main>
      </div>

      <SlideOver open={!!selected} onClose={closeRequestDetail}>
        {selected && (
          <RequestDetailPanel
            item={selected}
            onStatusChange={handleStatusChange}
            onCheckpointAdvance={handleAdvanceCheckpoint}
            actionBusy={actionBusy}
            onClose={closeRequestDetail}
          />
        )}
      </SlideOver>

      <SlideOver open={!!selectedSchedule} onClose={() => setSelectedScheduleId(null)}>
        {selectedSchedule && (
          <ScheduleDetailPanel
            item={selectedSchedule}
            onScheduleStatusChange={handleScheduleStatusChange}
            onEditTimeslot={handleEditTimeslot}
            onClose={() => setSelectedScheduleId(null)}
          />
        )}
      </SlideOver>

      <ConfirmDialog
        open={!!pendingRequestStatus}
        title={pendingRequestStatus ? `${requestActionLabel(pendingRequestStatus.next)} request?` : ""}
        confirmLabel={pendingRequestStatus ? requestActionLabel(pendingRequestStatus.next) : "Confirm"}
        destructive={pendingRequestStatus?.next === "Rejected" || pendingRequestStatus?.next === "Cancelled"}
        busy={actionBusy}
        onCancel={() => {
          if (!actionBusy) setPendingRequestStatus(null);
        }}
        onConfirm={confirmRequestStatusChange}
      />

      <ConfirmDialog
        open={!!pendingScheduleStatus}
        title={pendingScheduleStatus ? scheduleConfirmTitle(pendingScheduleStatus.next) : ""}
        confirmLabel={pendingScheduleStatus ? scheduleConfirmLabel(pendingScheduleStatus.next) : "Confirm"}
        destructive={pendingScheduleStatus?.next === "Cancelled"}
        busy={actionBusy}
        onCancel={() => {
          if (!actionBusy) setPendingScheduleStatus(null);
        }}
        onConfirm={confirmScheduleStatusChange}
      />

      <AssigneePickerDialog
        open={assigneePickerOpen && !!placement}
        assignees={availableAssignees}
        selected={placement?.assignee}
        scheduledFor={placement?.scheduledFor}
        onClose={() => setAssigneePickerOpen(false)}
        onSelect={(assignee) => {
          setPlacementError(null);
          setPlacement((current) => current ? { ...current, assignee } : current);
          setAssigneePickerOpen(false);
        }}
      />
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
      const assignedTo = fallbackAssignee(workspace, index);
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
          scheduleStatus: assignment.scheduleStatus,
          rescheduledFrom: assignment.rescheduledFrom,
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
      preferredSlot: preferredSlotForWorkItem(it),
      durationMinutes: scheduleDurationMinutes(),
    };
  });
}

function acceptPlacementId(item: WorkItem): string {
  return `accept:${item.id}`;
}

function scheduleItemFromAcceptPlacement(item: WorkItem, placement: SchedulePlacement): ScheduleItem {
  const type = item.task.selectedSubtypes[0] || item.route?.label || supportTypeLabels[item.supportType];
  return {
    id: acceptPlacementId(item),
    title: `${type} · ${item.session.careRecipientName}`,
    when: placement.scheduledFor,
    meta: `${item.session.generalArea ?? "Unknown area"} · In progress`,
    assignee: placement.assignee?.trim() || "Unassigned",
    status: "In progress",
    scheduleStatus: "Scheduled",
    visitMode: visitModeFromWorkItem(item),
    priority: deriveUrgency(item.task, item.session.createdAt),
    kind: item.supportType,
    preferredSlot: preferredSlotForWorkItem(item),
    durationMinutes: scheduleDurationMinutes(),
  };
}

function scheduleAssignmentFromMutation(
  item: WorkItem,
  workspace: WorkspaceConfig,
  mutation: ScheduleAssignmentMutationResult,
): DashboardScheduleAssignment {
  return {
    id: mutation.id,
    workspaceId: workspace.id,
    taskId: workItemTaskDbId(item) ?? undefined,
    routeId: workItemRouteDbId(item) ?? undefined,
    routeLabel: item.route?.label,
    supportType: item.supportType,
    requestStatus: "In progress",
    assigneeName: mutation.assigneeName,
    scheduledFor: mutation.scheduledFor,
    scheduleStatus: mutation.scheduleStatus,
    notes: mutation.notes,
    sessionId: item.session.id,
  };
}

function upsertScheduleAssignment(
  assignments: DashboardScheduleAssignment[] | null | undefined,
  assignment: DashboardScheduleAssignment,
): DashboardScheduleAssignment[] | null | undefined {
  if (assignments === undefined) return undefined;
  const current = assignments ?? [];
  const exists = current.some((candidate) => candidate.id === assignment.id);
  if (exists) return current.map((candidate) => candidate.id === assignment.id ? assignment : candidate);
  return [...current, assignment];
}

function updateScheduleAssignmentStatus(
  assignments: DashboardScheduleAssignment[] | null | undefined,
  assignmentId: string,
  next: ScheduleStatus,
): DashboardScheduleAssignment[] | null | undefined {
  if (assignments === undefined) return undefined;
  return (assignments ?? []).map((assignment) =>
    assignment.id === assignmentId
      ? { ...assignment, scheduleStatus: next, requestStatus: requestStatusFromScheduleStatus(next) ?? assignment.requestStatus }
      : assignment
  );
}

function updateScheduleAssignmentDetails(
  assignments: DashboardScheduleAssignment[] | null | undefined,
  assignmentId: string,
  details: { assigneeName?: string; scheduledFor: string; notes?: string },
): DashboardScheduleAssignment[] | null | undefined {
  if (assignments === undefined) return undefined;
  return (assignments ?? []).map((assignment) => {
    if (assignment.id !== assignmentId) return assignment;
    const scheduledChanged = Date.parse(assignment.scheduledFor) !== Date.parse(details.scheduledFor);
    return {
      ...assignment,
      assigneeName: details.assigneeName || undefined,
      scheduledFor: details.scheduledFor,
      notes: details.notes || undefined,
      scheduleStatus: scheduledChanged ? "Rescheduled" : assignment.scheduleStatus,
      requestStatus: "In progress",
      rescheduledFrom: scheduledChanged ? assignment.scheduledFor : assignment.rescheduledFrom,
    };
  });
}

function requestStatusFromScheduleStatus(status: ScheduleStatus): RequestStatus | null {
  switch (status) {
    case "Scheduled":
    case "In progress":
    case "Rescheduled":
      return "In progress";
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

function preferredSlotForWorkItem(item: WorkItem): PreferredScheduleSlot | undefined {
  const details = item.task.details ?? {};

  if (item.supportType === "transport") {
    const appointment = typeof details.appointmentDateTime === "string" ? details.appointmentDateTime : "";
    const appointmentMs = Date.parse(appointment);
    if (Number.isNaN(appointmentMs)) return undefined;
    const pickupIso = new Date(appointmentMs - 30 * 60_000).toISOString();
    return {
      iso: pickupIso,
      label: `Preferred pickup around ${formatScheduleTime(pickupIso)}`,
      durationMinutes: 60,
    };
  }

  if (item.supportType === "welfare") {
    const time = text(details.preferredTime);
    const iso = preferredDayIso(details, item.session.createdAt, preferredHour(time));
    if (!iso) return undefined;
    const day = preferredDayLabel(details, item.session.createdAt);
    const label = [day, time].filter(Boolean).join(" · ");
    return {
      iso,
      label: label || `Preferred around ${formatScheduleTime(iso)}`,
      durationMinutes: preferredDurationMinutes(time),
    };
  }

  return undefined;
}

function defaultPlacementIso(): string {
  const sgt = new Date(Date.now() + 8 * 3_600_000);
  let dayOffset = 0;
  let hour = sgt.getUTCHours() + 1;
  if (hour < 9) hour = 9;
  if (hour >= 18) {
    dayOffset = 1;
    hour = 9;
  }
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate() + dayOffset, hour - 8, 0)).toISOString();
}

function firstAvailablePlacementIso(seedIso: string, items: ScheduleItem[]): string {
  const seedMs = Date.parse(seedIso);
  if (Number.isNaN(seedMs)) return defaultPlacementIso();
  const roundedSeed = roundUpToQuarterHour(seedMs);
  const candidates: number[] = [];

  for (let day = 0; day < 14; day += 1) {
    const base = new Date(roundedSeed + 8 * 3_600_000);
    const dayStart = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + day) - 8 * 3_600_000;
    const startMinute = day === 0
      ? Math.max(9 * 60, minutesSinceSgtDayStart(roundedSeed))
      : 9 * 60;
    for (let minute = startMinute; minute <= 17 * 60; minute += 15) {
      candidates.push(dayStart + minute * 60_000);
    }
  }

  const available = candidates.find((candidate) => isCalendarSlotOpen(candidate, items));
  return new Date(available ?? roundedSeed).toISOString();
}

function roundUpToQuarterHour(ms: number): number {
  const quarterMs = 15 * 60_000;
  return Math.ceil(ms / quarterMs) * quarterMs;
}

function minutesSinceSgtDayStart(ms: number): number {
  const date = new Date(ms + 8 * 3_600_000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function isCalendarSlotOpen(startMs: number, items: ScheduleItem[]): boolean {
  const endMs = startMs + scheduleDurationMinutes() * 60_000;
  if (sgtDateKey(startMs) !== sgtDateKey(endMs - 1)) return false;
  if (minutesSinceSgtDayStart(startMs) < 9 * 60 || minutesSinceSgtDayStart(endMs) > 18 * 60) return false;

  return !items
    .filter((item) => item.scheduleStatus !== "Cancelled")
    .some((item) => {
      const itemStart = Date.parse(item.when);
      if (Number.isNaN(itemStart)) return false;
      return intervalsOverlap(startMs, endMs, itemStart, itemStart + scheduleDurationMinutes(item) * 60_000);
    });
}

function validateSchedulePlacementClient(items: ScheduleItem[], placement: SchedulePlacement, assignee: string): string | null {
  if (!assignee.trim()) return "Assignee is required";
  const startMs = Date.parse(placement.scheduledFor);
  if (Number.isNaN(startMs)) return "Scheduled time is invalid";
  const endMs = startMs + scheduleDurationMinutes() * 60_000;
  if (sgtDateKey(startMs) !== sgtDateKey(endMs - 1)) return "Scheduled time is outside working hours";
  if (minutesSinceSgtDayStart(startMs) < 9 * 60 || minutesSinceSgtDayStart(endMs) > 18 * 60) {
    return "Scheduled time is outside working hours";
  }

  const overlaps = items
    .filter((item) => item.id !== placement.itemId)
    .filter((item) => item.scheduleStatus !== "Cancelled")
    .some((item) => {
      const itemStart = Date.parse(item.when);
      if (Number.isNaN(itemStart)) return false;
      return intervalsOverlap(startMs, endMs, itemStart, itemStart + scheduleDurationMinutes(item) * 60_000);
    });

  return overlaps ? "Timeslot overlaps another session" : null;
}

function sgtDateKey(ms: number): string {
  const date = new Date(ms + 8 * 3_600_000);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function preferredDayLabel(details: Record<string, unknown>, createdAt: string): string {
  const checkInDay = text(details.checkInDay);
  if (checkInDay === "Choose date") return formatDateOnly(text(details.checkInDayValue));
  if (checkInDay) return checkInDay;
  return formatDateOnly(createdAt);
}

function preferredDayIso(details: Record<string, unknown>, createdAt: string, hour: number): string | undefined {
  const checkInDay = text(details.checkInDay);
  if (checkInDay === "Choose date") return dateAtSgtHour(text(details.checkInDayValue), hour);
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return undefined;
  const offset = checkInDay === "Tomorrow" ? 1 : 0;
  const sgt = new Date(created + 8 * 3_600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate() + offset, hour - 8, 0)).toISOString();
}

function dateAtSgtHour(iso: string, hour: number): string | undefined {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  const sgt = new Date(ms + 8 * 3_600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate(), hour - 8, 0)).toISOString();
}

function preferredHour(label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes("afternoon")) return 14;
  if (lower.includes("evening")) return 17;
  return 9;
}

function preferredDurationMinutes(label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes("morning") || lower.includes("afternoon") || lower.includes("evening")) return 180;
  return 90;
}

function formatDateOnly(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function availableAssigneesForSlot(
  workspace: WorkspaceConfig,
  items: ScheduleItem[],
  placement: SchedulePlacement,
): string[] {
  const targetMs = Date.parse(placement.scheduledFor);
  const targetEndMs = targetMs + scheduleDurationMinutes() * 60_000;
  const busy = new Set(
    items
      .filter((item) => item.id !== placement.itemId)
      .filter((item) => item.scheduleStatus !== "Cancelled")
      .filter((item) => {
        const ms = Date.parse(item.when);
        const endMs = ms + scheduleDurationMinutes(item) * 60_000;
        return !Number.isNaN(ms) && !Number.isNaN(targetMs) && intervalsOverlap(targetMs, targetEndMs, ms, endMs);
      })
      .map((item) => item.assignee?.trim())
      .filter((name): name is string => Boolean(name))
  );

  return assigneesForWorkspace(workspace).filter((assignee) => !busy.has(assignee));
}

function scheduleDurationMinutes(item?: ScheduleItem): number {
  return item?.durationMinutes ?? 60;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function fallbackAssignee(workspace: WorkspaceConfig, index: number): string {
  const roster = assigneesForWorkspace(workspace);
  return roster[index % Math.max(roster.length, 1)] ?? "Unassigned";
}

function requestActionLabel(status: RequestStatus): string {
  switch (status) {
    case "Accepted":
      return "Accept";
    case "Rejected":
      return "Reject";
    case "In progress":
      return "Start";
    case "Completed":
      return "Complete";
    case "Cancelled":
      return "Cancel";
    default:
      return status;
  }
}

function scheduleActionLabel(status: ScheduleStatus): string {
  switch (status) {
    case "Completed":
      return "Complete";
    case "Cancelled":
      return "Cancel";
    default:
      return status;
  }
}

function scheduleConfirmTitle(status: ScheduleStatus): string {
  if (status === "Cancelled") return "Cancel scheduled task?";
  return `${scheduleActionLabel(status)} scheduled task?`;
}

function scheduleConfirmLabel(status: ScheduleStatus): string {
  if (status === "Cancelled") return "Cancel task";
  return scheduleActionLabel(status);
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

function formatScheduleTime(iso: string) {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

function applyStatus(
  sessions: RequestSession[],
  item: WorkItem,
  next: RequestStatus,
  reason?: string,
  scheduleDetails?: { assigneeName?: string; scheduledFor: string; notes?: string },
): RequestSession[] {
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
      return {
        ...t,
        status: next,
        ...(reason && next === "Rejected" ? { rejectionReason: reason } : {}),
        ...(scheduleDetails
          ? {
              assignedTo: scheduleDetails.assigneeName,
              scheduledFor: scheduleDetails.scheduledFor,
              scheduleStatus: "Scheduled" as const,
              partnerNotes: scheduleDetails.notes,
            }
          : next === "Completed" || next === "Cancelled"
            ? { scheduleStatus: next }
            : {}),
      };
    });
    return { ...s, tasks, overallStatus: rollupStatus(tasks.map(taskStatus)) };
  });
}

function applyScheduleDetails(
  sessions: RequestSession[],
  item: WorkItem,
  details: { assigneeName?: string; scheduledFor: string; notes?: string },
  scheduleStatus: "Scheduled" | "Rescheduled",
): RequestSession[] {
  return sessions.map((s) => {
    if (s.id !== item.sessionId) return s;
    const tasks = s.tasks.map((t) =>
      t.supportType === item.supportType
        ? {
            ...t,
            status: "In progress" as RequestStatus,
            assignedTo: details.assigneeName,
            scheduledFor: details.scheduledFor,
            scheduleStatus,
            partnerNotes: details.notes,
            ...(scheduleStatus === "Rescheduled" ? { rescheduledFrom: item.task.scheduledFor } : {}),
          }
        : t
    );
    return { ...s, tasks, overallStatus: rollupStatus(tasks.map(taskStatus)) };
  });
}

function applyTaskReroute(
  sessions: RequestSession[],
  item: WorkItem,
  reason?: string,
): RequestSession[] {
  return sessions.map((s) => {
    if (s.id !== item.sessionId) return s;
    const tasks = s.tasks.map((t) =>
      t.supportType === item.supportType
        ? {
            ...t,
            status: "Rejected" as RequestStatus,
            primaryOrganisationId: item.ownerOrgId ?? t.primaryOrganisationId,
            fallbackOrganisationIds: [],
            assignedTo: undefined,
            scheduledFor: undefined,
            scheduleStatus: undefined,
            rescheduledFrom: undefined,
            partnerNotes: undefined,
            rejectionReason: reason,
          }
        : t
    );
    return { ...s, tasks, overallStatus: rollupStatus(tasks.map(taskStatus)) };
  });
}

function scheduledChangedStatus(previous: string | undefined, next: string): "Scheduled" | "Rescheduled" {
  return previous && Date.parse(previous) !== Date.parse(next) ? "Rescheduled" : "Scheduled";
}

function applyRouteCheckpoint(
  sessions: RequestSession[],
  item: WorkItem,
  stage: FulfilmentCheckpointStage,
  completedAt: string,
  actorName?: string,
): RequestSession[] {
  if (!item.route) return sessions;
  const label = checkpointLabel(stage);
  const nextStatus = requestStatusForCheckpointStage(stage, item.task, item.route);

  return sessions.map((s) => {
    if (s.id !== item.sessionId) return s;
    const tasks = s.tasks.map((t) => {
      if (t.supportType !== item.supportType) return t;
      const routes = (t.fulfilmentRoutes ?? []).map((r) => {
        if (r.label !== item.route!.label) return r;
        const checkpoints = [
          ...(r.checkpoints ?? []).filter((checkpoint) => checkpoint.stage !== stage),
          { stage, label, completedAt, actorName },
        ].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
        return {
          ...r,
          lifecycle: nextStatus,
          checkpoints,
          displayStatus: label,
          displayStatusUpdatedAt: completedAt,
        };
      });
      const updatedTask = { ...t, fulfilmentRoutes: routes };
      return { ...updatedTask, status: taskStatus(updatedTask) };
    });
    return { ...s, tasks, overallStatus: rollupStatus(tasks.map(taskStatus)) };
  });
}

function requestStatusForCheckpointStage(
  stage: FulfilmentCheckpointStage,
  task: WorkItem["task"],
  route: NonNullable<WorkItem["route"]>,
): RequestStatus {
  if (stage === "accepted") return "Accepted";
  const stages = routeCheckpointStages(task, route);
  return stage === stages[stages.length - 1] ? "Completed" : "In progress";
}

function ConfirmDialog({
  open,
  title,
  confirmLabel,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15.5px] font-semibold text-slate-800">{title}</h2>
            <p className="mt-2 text-[13px] font-medium text-slate-400">This action cannot be undone.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close confirmation"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-colors disabled:cursor-wait disabled:opacity-60",
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
            )}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssigneePickerDialog({
  open,
  assignees,
  selected,
  scheduledFor,
  onClose,
  onSelect,
}: {
  open: boolean;
  assignees: string[];
  selected?: string;
  scheduledFor?: string;
  onClose: () => void;
  onSelect: (assignee: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Select assignee</h2>
            <p className="mt-1 text-xs text-slate-400">{scheduledFor ? formatScheduleTime(scheduledFor) : "Selected timeslot"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close assignee picker">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-1.5">
          {assignees.length ? assignees.map((assignee) => (
            <button
              key={assignee}
              type="button"
              onClick={() => onSelect(assignee)}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                selected === assignee
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              {assignee}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Available</span>
            </button>
          )) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No listed assignees are available at this time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
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

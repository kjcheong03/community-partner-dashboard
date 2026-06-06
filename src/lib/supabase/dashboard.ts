import { createSupabaseServerClient, hasSupabaseServerConfig } from "./server";
import {
  checkpointLabel,
  type FulfilmentCheckpoint,
  type FulfilmentCheckpointStage,
  type FulfilmentRoute,
  type RequestSession,
  type RequestStatus,
  type RequestTaskSession,
  type SupportTypeId,
} from "@/lib/contract";
import type { InventoryRow, InventoryStatus } from "@/components/kit/InventoryTable";
import type { DashboardScheduleAssignment, ScheduleStatus } from "@/lib/schedule";
import type { WorkspaceConfig } from "@/lib/workspaces";

type RequestRouteRow = {
  id: string;
  workspace_id: string;
  label: string;
  quantity: number | null;
  route_name: string;
  logo: string | null;
  organisation_id: string | null;
  route_type: FulfilmentRoute["routeType"];
  availability_mode: FulfilmentRoute["availabilityMode"];
  cost_label: string;
  detail: string | null;
  status: string;
  lifecycle: RequestStatus | null;
};

type RouteCheckpointRow = {
  route_id: string;
  stage: FulfilmentCheckpointStage;
  completed_at: string;
  actor_name: string | null;
  notes: string | null;
};

type WorkspaceWorkItemRow = {
  workspace_id: string;
  relation: "primary" | "backup" | "owner" | "rejected";
  item_kind: "partner-task" | "food-route" | "supplies-route";
  session_id: string;
  task_id: string;
  route_id: string | null;
  support_type: SupportTypeId;
  status: RequestStatus;
  overall_status: RequestStatus;
  created_at: string;
  caregiver_name: string;
  care_recipient_name: string;
  contact_number: string;
  contact_method: string;
  email: string | null;
  relationship: string | null;
  general_area: string | null;
  address: string | null;
  postal_code: string | null;
  access_notes: string | null;
  linked_topic: string;
  selected_subtypes: string[] | null;
  details: Record<string, unknown> | null;
  cost_estimate: RequestTaskSession["costEstimate"] | null;
  assigned_to: string | null;
  rejection_reason: string | null;
  scheduled_for: string | null;
  partner_notes: string | null;
  route_label: string | null;
  route_type: FulfilmentRoute["routeType"] | null;
  route_status: string | null;
  route_lifecycle: RequestStatus | null;
};

type InventoryDashboardRow = {
  id: string;
  workspace_id: string;
  sku: string;
  item_name: string;
  item_group: string | null;
  item_variant: string | null;
  available_count: number;
  reserved_count: number;
  fulfilled_count: number;
  low_stock_threshold: number;
  collection_point: string;
  last_updated: string;
  stock_status: InventoryStatus;
};

type ScheduleDashboardRow = {
  id: string;
  workspace_id: string;
  task_id: string | null;
  route_id: string | null;
  route_label: string | null;
  support_type: SupportTypeId;
  request_status: RequestStatus;
  assignee_name: string | null;
  scheduled_for: string;
  schedule_status: ScheduleStatus;
  rescheduled_from: string | null;
  notes: string | null;
  session_id: string;
};

export type WorkspaceDashboardData = {
  sessions: RequestSession[];
  inventoryRows: InventoryRow[] | null;
  scheduleAssignments: DashboardScheduleAssignment[] | null;
};

export async function fetchWorkspaceDashboardData(workspace: WorkspaceConfig): Promise<WorkspaceDashboardData | null> {
  if (!hasSupabaseServerConfig()) return null;

  const supabase = createSupabaseServerClient();

  const [
    { data: workItemRows, error: workItemsError },
    { data: inventoryRows, error: inventoryError },
    { data: scheduleRows, error: scheduleError },
  ] = await Promise.all([
    supabase
      .from("workspace_work_items")
      .select(`
        workspace_id,
        relation,
        item_kind,
        session_id,
        task_id,
        route_id,
        support_type,
        status,
        overall_status,
        created_at,
        caregiver_name,
        care_recipient_name,
        contact_number,
        contact_method,
        email,
        relationship,
        general_area,
        address,
        postal_code,
        access_notes,
        linked_topic,
        selected_subtypes,
        details,
        cost_estimate,
        assigned_to,
        rejection_reason,
        scheduled_for,
        partner_notes,
        route_label,
        route_type,
        route_status,
        route_lifecycle
      `)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    workspace.inventoryKind
      ? supabase
          .from("inventory_dashboard")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("item_group", { ascending: true, nullsFirst: false })
          .order("item_name", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    workspace.scheduleKind
      ? supabase
          .from("schedule_dashboard")
          .select(`
            id,
            workspace_id,
            task_id,
            route_id,
            route_label,
            support_type,
            request_status,
            assignee_name,
            scheduled_for,
            schedule_status,
            rescheduled_from,
            notes,
            session_id
          `)
          .eq("workspace_id", workspace.id)
          .order("scheduled_for", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (workItemsError) {
    console.error("Failed to load Supabase workspace work items", workItemsError);
    return null;
  }
  if (inventoryError) {
    console.error("Failed to load Supabase inventory", inventoryError);
    return null;
  }
  if (scheduleError) {
    console.error("Failed to load Supabase schedule assignments", scheduleError);
    return null;
  }

  const scopedWorkItemRows = (workItemRows ?? []) as WorkspaceWorkItemRow[];
  const scopedScheduleRows = (scheduleRows ?? []) as ScheduleDashboardRow[];
  const routeDetails = await fetchRouteDetails(scopedWorkItemRows);
  const routeCheckpoints = await fetchRouteCheckpoints(scopedWorkItemRows);

  return {
    sessions: mapWorkspaceWorkItemSessions(scopedWorkItemRows, routeDetails, routeCheckpoints, scopedScheduleRows),
    inventoryRows: workspace.inventoryKind
      ? mapInventoryRows((inventoryRows ?? []) as InventoryDashboardRow[], workspace)
      : null,
    scheduleAssignments: workspace.scheduleKind
      ? mapScheduleAssignments(scopedScheduleRows)
      : null,
  };
}

async function fetchRouteCheckpoints(rows: WorkspaceWorkItemRow[]): Promise<Map<string, FulfilmentCheckpoint[]>> {
  const routeIds = [...new Set(rows.map((row) => row.route_id).filter((id): id is string => Boolean(id)))];
  if (!routeIds.length) return new Map();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("request_route_checkpoints")
    .select("route_id, stage, completed_at, actor_name, notes")
    .in("route_id", routeIds)
    .order("completed_at", { ascending: true });

  if (error) {
    console.warn("Route checkpoints unavailable; run db/004_route_fulfilment_checkpoints.sql to enable them.", error.message);
    return new Map();
  }

  const mapped = new Map<string, FulfilmentCheckpoint[]>();
  for (const row of (data ?? []) as RouteCheckpointRow[]) {
    mapped.set(row.route_id, [
      ...(mapped.get(row.route_id) ?? []),
      {
        stage: row.stage,
        label: checkpointLabel(row.stage),
        completedAt: row.completed_at,
        actorName: row.actor_name ?? undefined,
        notes: row.notes ?? undefined,
      },
    ]);
  }

  return mapped;
}

async function fetchRouteDetails(rows: WorkspaceWorkItemRow[]): Promise<Map<string, RequestRouteRow>> {
  const routeIds = [...new Set(rows.map((row) => row.route_id).filter((id): id is string => Boolean(id)))];
  if (!routeIds.length) return new Map();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("request_routes")
    .select(`
      id,
      workspace_id,
      label,
      quantity,
      route_name,
      logo,
      organisation_id,
      route_type,
      availability_mode,
      cost_label,
      detail,
      status,
      lifecycle
    `)
    .in("id", routeIds);

  if (error) {
    console.error("Failed to load Supabase route details", error);
    return new Map();
  }

  return new Map(((data ?? []) as RequestRouteRow[]).map((row) => [row.id, row]));
}

function mapWorkspaceWorkItemSessions(
  rows: WorkspaceWorkItemRow[],
  routeDetails: Map<string, RequestRouteRow>,
  routeCheckpoints: Map<string, FulfilmentCheckpoint[]>,
  scheduleRows: ScheduleDashboardRow[],
): RequestSession[] {
  const sessions = new Map<string, RequestSession>();
  const tasksBySession = new Map<string, Map<string, RequestTaskSession & { dbId?: string }>>();
  const scheduleByTaskId = latestScheduleByTaskId(scheduleRows);

  for (const row of rows) {
    let session = sessions.get(row.session_id);
    if (!session) {
      session = {
        id: row.session_id,
        careRecipientName: row.care_recipient_name,
        caregiverName: row.caregiver_name,
        contactNumber: row.contact_number,
        contactMethod: row.contact_method,
        email: row.email ?? undefined,
        relationship: row.relationship ?? undefined,
        generalArea: row.general_area ?? undefined,
        address: row.address ?? undefined,
        postalCode: row.postal_code ?? undefined,
        accessNotes: row.access_notes ?? undefined,
        linkedTopic: row.linked_topic,
        createdAt: row.created_at,
        overallStatus: row.overall_status,
        tasks: [],
      };
      sessions.set(row.session_id, session);
      tasksBySession.set(row.session_id, new Map());
    }

    const taskMap = tasksBySession.get(row.session_id);
    if (!taskMap) continue;

    let task = taskMap.get(row.task_id);
    if (!task) {
      task = mapWorkspaceWorkItemTask(row, scheduleByTaskId.get(row.task_id));
      taskMap.set(row.task_id, task);
      session.tasks.push(task);
    }

    if (row.route_id) {
      const route = mapWorkspaceWorkItemRoute(row, routeDetails.get(row.route_id), routeCheckpoints.get(row.route_id) ?? []);
      if (route && !task.fulfilmentRoutes?.some((existing) => requestRouteDbId(existing) === row.route_id)) {
        task.fulfilmentRoutes = [...(task.fulfilmentRoutes ?? []), route];
      }
    }
  }

  return [...sessions.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function mapWorkspaceWorkItemTask(row: WorkspaceWorkItemRow, schedule: ScheduleDashboardRow | undefined): RequestTaskSession & { dbId?: string } {
  const isRouteTask = row.item_kind === "food-route" || row.item_kind === "supplies-route";
  return {
    id: row.support_type,
    dbId: row.task_id,
    fulfilment: isRouteTask ? "route" : "partner",
    supportType: row.support_type,
    selectedSubtypes: row.selected_subtypes ?? [],
    details: row.details ?? {},
    primaryOrganisationId: row.relation === "primary" || row.relation === "rejected" ? row.workspace_id : "",
    fallbackOrganisationIds: row.relation === "backup" ? [row.workspace_id] : [],
    fulfilmentRoutes: [],
    costEstimate: row.cost_estimate ?? undefined,
    status: row.status,
    assignedTo: schedule?.assignee_name ?? row.assigned_to ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    scheduledFor: schedule?.scheduled_for ?? row.scheduled_for ?? undefined,
    scheduleStatus: schedule?.schedule_status,
    rescheduledFrom: schedule?.rescheduled_from ?? undefined,
    partnerNotes: schedule?.notes ?? row.partner_notes ?? undefined,
  };
}

function latestScheduleByTaskId(rows: ScheduleDashboardRow[]): Map<string, ScheduleDashboardRow> {
  const mapped = new Map<string, ScheduleDashboardRow>();
  for (const row of rows) {
    if (!row.task_id) continue;
    const current = mapped.get(row.task_id);
    if (!current || Date.parse(row.scheduled_for) >= Date.parse(current.scheduled_for)) {
      mapped.set(row.task_id, row);
    }
  }
  return mapped;
}

function mapWorkspaceWorkItemRoute(
  row: WorkspaceWorkItemRow,
  detail: RequestRouteRow | undefined,
  checkpoints: FulfilmentCheckpoint[],
): (FulfilmentRoute & { dbId?: string; workspaceId?: string }) | null {
  if (!row.route_id || (!detail && (!row.route_label || !row.route_type))) return null;

  return {
    dbId: row.route_id,
    workspaceId: detail?.workspace_id ?? row.workspace_id,
    label: detail?.label ?? row.route_label ?? "",
    quantity: Number(detail?.quantity ?? 1),
    routeName: detail?.route_name ?? row.route_label ?? "",
    logo: detail?.logo ?? undefined,
    organisationId: detail?.organisation_id ?? (row.route_type === "partner_service" ? row.workspace_id : undefined),
    routeType: detail?.route_type ?? row.route_type ?? "public_distribution",
    availabilityMode: detail?.availability_mode ?? "local_stock_subject_to_availability",
    costLabel: detail?.cost_label ?? (row.item_kind === "supplies-route" ? "Free" : "Partner assessment"),
    detail: detail?.detail ?? undefined,
    status: detail?.status ?? row.route_status ?? "",
    lifecycle: detail?.lifecycle ?? row.route_lifecycle ?? undefined,
    checkpoints,
    displayStatus: checkpoints[checkpoints.length - 1]?.label,
    displayStatusUpdatedAt: checkpoints[checkpoints.length - 1]?.completedAt,
  };
}

function mapInventoryRows(rows: InventoryDashboardRow[], workspace: WorkspaceConfig): InventoryRow[] {
  const mapped = rows.map((row) => inventoryRow(row));

  if (workspace.inventoryKind !== "cooked-meals") return mapped;

  const groups = new Map<string, InventoryRow[]>();
  for (const row of mapped) {
    const group = row.group ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }

  return ["Lunch", "Dinner"].flatMap((group) => {
    const children = groups.get(group) ?? [];
    if (!children.length) return [];
    return [aggregateInventoryGroup(group, children)];
  });
}

function inventoryRow(row: InventoryDashboardRow): InventoryRow {
  return {
    id: row.id,
    item: row.item_name,
    group: row.item_group ?? undefined,
    available: row.available_count,
    reserved: row.reserved_count,
    fulfilled: row.fulfilled_count,
    collectionPoint: row.collection_point,
    lastUpdated: formatInventoryDate(row.last_updated),
    status: row.stock_status,
    threshold: row.low_stock_threshold,
  };
}

function aggregateInventoryGroup(group: string, children: InventoryRow[]): InventoryRow {
  const available = children.reduce((sum, child) => sum + child.available, 0);
  const reserved = children.reduce((sum, child) => sum + child.reserved, 0);
  const fulfilled = children.reduce((sum, child) => sum + (child.fulfilled ?? 0), 0);
  const threshold = children.reduce((sum, child) => sum + child.threshold, 0);

  return {
    id: `meal:${group}`,
    item: group,
    group,
    available,
    reserved,
    fulfilled,
    collectionPoint: "Meal prep shelves",
    lastUpdated: latestDisplayDate(children.map((child) => child.lastUpdated)),
    status: inventoryStatus(available, threshold),
    threshold,
    children,
  };
}

function mapScheduleAssignments(rows: ScheduleDashboardRow[]): DashboardScheduleAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    taskId: row.task_id ?? undefined,
    routeId: row.route_id ?? undefined,
    routeLabel: row.route_label ?? undefined,
    supportType: row.support_type,
    requestStatus: row.request_status,
    assigneeName: row.assignee_name ?? undefined,
    scheduledFor: row.scheduled_for,
    scheduleStatus: row.schedule_status,
    rescheduledFrom: row.rescheduled_from ?? undefined,
    notes: row.notes ?? undefined,
    sessionId: row.session_id,
  }));
}

function inventoryStatus(available: number, threshold: number): InventoryStatus {
  if (available === 0) return "Out";
  if (available < threshold) return "Low";
  return "OK";
}

function formatInventoryDate(iso: string) {
  return new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function latestDisplayDate(values: string[]) {
  return values.reduce((latest, value) => {
    const parsedLatest = Date.parse(latest);
    const parsedValue = Date.parse(value);
    if (!Number.isNaN(parsedLatest) && !Number.isNaN(parsedValue)) return parsedValue > parsedLatest ? value : latest;
    return latest;
  }, values[0] ?? "");
}

export function requestTaskDbId(task: RequestTaskSession): string | null {
  return (task as RequestTaskSession & { dbId?: string }).dbId ?? null;
}

export function requestRouteDbId(route: FulfilmentRoute | undefined): string | null {
  return (route as (FulfilmentRoute & { dbId?: string }) | undefined)?.dbId ?? null;
}

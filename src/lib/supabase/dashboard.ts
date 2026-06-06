import { createSupabaseServerClient, hasSupabaseServerConfig } from "./server";
import {
  rollupStatus,
  taskStatus,
  type FulfilmentRoute,
  type RequestSession,
  type RequestStatus,
  type RequestTaskSession,
  type SupportTypeId,
} from "@/lib/contract";
import type { InventoryRow, InventoryStatus } from "@/components/kit/InventoryTable";
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

type RequestTaskRow = {
  id: string;
  task_key: string;
  fulfilment: RequestTaskSession["fulfilment"];
  support_type: SupportTypeId;
  selected_subtypes: string[] | null;
  details: Record<string, unknown> | null;
  primary_org_id: string | null;
  fallback_org_ids: string[] | null;
  cost_estimate: RequestTaskSession["costEstimate"] | null;
  status: RequestStatus;
  assigned_to: string | null;
  rejection_reason: string | null;
  scheduled_for: string | null;
  partner_notes: string | null;
  request_routes?: RequestRouteRow[] | null;
};

type RequestSessionRow = {
  id: string;
  care_recipient_name: string;
  caregiver_name: string;
  contact_number: string;
  contact_method: string;
  email: string | null;
  relationship: string | null;
  general_area: string | null;
  address: string | null;
  postal_code: string | null;
  access_notes: string | null;
  linked_topic: string;
  overall_status: RequestStatus;
  created_at: string;
  request_tasks?: RequestTaskRow[] | null;
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

export type WorkspaceDashboardData = {
  sessions: RequestSession[];
  inventoryRows: InventoryRow[] | null;
};

export async function fetchWorkspaceDashboardData(workspace: WorkspaceConfig): Promise<WorkspaceDashboardData | null> {
  if (!hasSupabaseServerConfig()) return null;

  const supabase = createSupabaseServerClient();

  const [{ data: sessionRows, error: sessionsError }, { data: inventoryRows, error: inventoryError }] = await Promise.all([
    supabase
      .from("request_sessions")
      .select(`
        id,
        care_recipient_name,
        caregiver_name,
        contact_number,
        contact_method,
        email,
        relationship,
        general_area,
        address,
        postal_code,
        access_notes,
        linked_topic,
        overall_status,
        created_at,
        request_tasks (
          id,
          task_key,
          fulfilment,
          support_type,
          selected_subtypes,
          details,
          primary_org_id,
          fallback_org_ids,
          cost_estimate,
          status,
          assigned_to,
          rejection_reason,
          scheduled_for,
          partner_notes,
          request_routes (
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
          )
        )
      `)
      .order("created_at", { ascending: false }),
    workspace.inventoryKind
      ? supabase
          .from("inventory_dashboard")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("item_group", { ascending: true, nullsFirst: false })
          .order("item_name", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (sessionsError) {
    console.error("Failed to load Supabase request sessions", sessionsError);
    return null;
  }
  if (inventoryError) {
    console.error("Failed to load Supabase inventory", inventoryError);
    return null;
  }

  return {
    sessions: mapRequestSessions((sessionRows ?? []) as RequestSessionRow[]),
    inventoryRows: workspace.inventoryKind
      ? mapInventoryRows((inventoryRows ?? []) as InventoryDashboardRow[], workspace)
      : null,
  };
}

function mapRequestSessions(rows: RequestSessionRow[]): RequestSession[] {
  return rows.map((row) => {
    const tasks = (row.request_tasks ?? []).map(mapRequestTask);
    return {
      id: row.id,
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
      overallStatus: tasks.length ? rollupStatus(tasks.map(taskStatus)) : row.overall_status,
      tasks,
    };
  });
}

function mapRequestTask(row: RequestTaskRow): RequestTaskSession {
  const task: RequestTaskSession & { dbId?: string } = {
    id: row.task_key || row.support_type,
    dbId: row.id,
    fulfilment: row.fulfilment,
    supportType: row.support_type,
    selectedSubtypes: row.selected_subtypes ?? [],
    details: row.details ?? {},
    primaryOrganisationId: row.primary_org_id ?? "",
    fallbackOrganisationIds: row.fallback_org_ids ?? [],
    fulfilmentRoutes: (row.request_routes ?? []).map(mapRequestRoute),
    costEstimate: row.cost_estimate ?? undefined,
    status: row.status,
    assignedTo: row.assigned_to ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    scheduledFor: row.scheduled_for ?? undefined,
    partnerNotes: row.partner_notes ?? undefined,
  };

  return task;
}

function mapRequestRoute(row: RequestRouteRow): FulfilmentRoute {
  const route: FulfilmentRoute & { dbId?: string; workspaceId?: string } = {
    dbId: row.id,
    workspaceId: row.workspace_id,
    label: row.label,
    quantity: Number(row.quantity ?? 1),
    routeName: row.route_name,
    logo: row.logo ?? undefined,
    organisationId: row.organisation_id ?? undefined,
    routeType: row.route_type,
    availabilityMode: row.availability_mode,
    costLabel: row.cost_label,
    detail: row.detail ?? undefined,
    status: row.status,
    lifecycle: row.lifecycle ?? undefined,
  };

  return route;
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

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { TRANSITIONS, type FulfilmentRoute, type RequestStatus } from "@/lib/contract";
import type { ScheduleStatus } from "@/lib/schedule";
import { getWorkspaceBySlug, type ScheduleKind, type WorkspaceConfig } from "@/lib/workspaces";

type StatusTarget = {
  workspaceSlug: string;
  taskId?: string | null;
  routeId?: string | null;
  next: RequestStatus;
  reason?: string;
};

export async function updateWorkItemStatusAction(target: StatusTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const workspace = getWorkspaceBySlug(target.workspaceSlug);
  if (!workspace) return { ok: false, error: "Unknown workspace" };

  const supabase = createSupabaseServerClient();

  if (target.routeId) {
    const { data: route, error: routeError } = await supabase
      .from("request_routes")
      .select("lifecycle, route_type")
      .eq("id", target.routeId)
      .single<{ lifecycle: RequestStatus | null; route_type: FulfilmentRoute["routeType"] }>();
    if (routeError) return { ok: false, error: routeError.message };

    const fromStatus = route.lifecycle ?? "Pending";
    const scope = route.route_type === "partner_service" ? "full" : "reduced";
    if (target.next !== fromStatus && !TRANSITIONS[scope][fromStatus].includes(target.next)) {
      return { ok: false, error: `Invalid ${scope} transition from ${fromStatus} to ${target.next}` };
    }

    const { error } = await supabase
      .from("request_routes")
      .update({ lifecycle: target.next })
      .eq("id", target.routeId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("request_status_events").insert({
      route_id: target.routeId,
      from_status: fromStatus,
      to_status: target.next,
      reason: target.reason ?? null,
    });

    await ensureScheduleAssignmentForAccepted(supabase, workspace, target);
  } else if (target.taskId) {
    const { error } = await supabase
      .from("request_tasks")
      .update({
        status: target.next,
        rejection_reason: target.reason ?? null,
      })
      .eq("id", target.taskId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("request_status_events").insert({
      task_id: target.taskId,
      to_status: target.next,
      reason: target.reason ?? null,
    });

    await ensureScheduleAssignmentForAccepted(supabase, workspace, target);
  } else {
    return { ok: false, error: "Missing task or route id" };
  }

  revalidatePath(`/${target.workspaceSlug}`);
  return { ok: true };
}

type ScheduleStatusTarget = {
  workspaceSlug: string;
  scheduleAssignmentId: string;
  next: ScheduleStatus;
};

const SCHEDULE_TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  Scheduled: ["In progress", "Completed", "Cancelled", "Rescheduled"],
  "In progress": ["Completed", "Cancelled", "Rescheduled"],
  Rescheduled: ["In progress", "Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export async function updateScheduleAssignmentStatusAction(target: ScheduleStatusTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const supabase = createSupabaseServerClient();

  const { data: assignment, error: readError } = await supabase
    .from("schedule_assignments")
    .select("status")
    .eq("id", target.scheduleAssignmentId)
    .single<{ status: ScheduleStatus }>();
  if (readError) return { ok: false, error: readError.message };

  if (target.next !== assignment.status && !SCHEDULE_TRANSITIONS[assignment.status].includes(target.next)) {
    return { ok: false, error: `Invalid schedule transition from ${assignment.status} to ${target.next}` };
  }

  const { error } = await supabase
    .from("schedule_assignments")
    .update({ status: target.next })
    .eq("id", target.scheduleAssignmentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${target.workspaceSlug}`);
  return { ok: true };
}

type InventoryTarget = {
  workspaceSlug: string;
  inventoryItemId: string;
  available: number;
  fulfilled?: number;
  reason?: string;
};

export async function updateInventoryStockAction(target: InventoryTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const supabase = createSupabaseServerClient();
  const stockCount = Math.max(0, Math.round(target.available + (target.fulfilled ?? 0)));

  const { error } = await supabase
    .from("inventory_items")
    .update({ stock_count: stockCount })
    .eq("id", target.inventoryItemId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("inventory_movements").insert({
    inventory_item_id: target.inventoryItemId,
    movement_type: "correction",
    quantity_delta: 0,
    count_after: stockCount,
    reason: target.reason ?? "Dashboard stock edit",
  });

  revalidatePath(`/${target.workspaceSlug}`);
  return { ok: true };
}

async function ensureScheduleAssignmentForAccepted(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  workspace: WorkspaceConfig,
  target: StatusTarget,
) {
  if (target.next !== "Accepted" || !workspace.scheduleKind) return;
  if (!target.taskId && !target.routeId) return;

  const existingQuery = supabase
    .from("schedule_assignments")
    .select("id")
    .eq("workspace_id", workspace.id)
    .limit(1);
  const { data: existing, error: existingError } = target.routeId
    ? await existingQuery.eq("route_id", target.routeId)
    : await existingQuery.eq("task_id", target.taskId);
  if (existingError || existing?.length) return;

  const taskDetails = target.taskId
    ? await readScheduleTaskDetails(supabase, target.taskId)
    : { details: {}, scheduledFor: null };

  const insertRow: {
    workspace_id: string;
    task_id?: string;
    route_id?: string;
    scheduled_for: string;
    status: ScheduleStatus;
    notes: string;
  } = {
    workspace_id: workspace.id,
    scheduled_for: defaultScheduledFor(workspace.scheduleKind, taskDetails.details, taskDetails.scheduledFor),
    status: "Scheduled",
    notes: "Created when request was accepted.",
  };

  if (target.routeId) insertRow.route_id = target.routeId;
  else if (target.taskId) insertRow.task_id = target.taskId;

  await supabase.from("schedule_assignments").insert(insertRow);
}

async function readScheduleTaskDetails(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  taskId: string,
): Promise<{ details: Record<string, unknown>; scheduledFor: string | null }> {
  const { data, error } = await supabase
    .from("request_tasks")
    .select("details, scheduled_for")
    .eq("id", taskId)
    .single<{ details: Record<string, unknown> | null; scheduled_for: string | null }>();
  if (error) return { details: {}, scheduledFor: null };
  return { details: data.details ?? {}, scheduledFor: data.scheduled_for };
}

function defaultScheduledFor(scheduleKind: ScheduleKind, details: Record<string, unknown>, existing?: string | null): string {
  if (existing) return existing;

  if (scheduleKind === "transport") {
    const appointment = typeof details.appointmentDateTime === "string" ? Date.parse(details.appointmentDateTime) : NaN;
    if (!Number.isNaN(appointment)) return new Date(appointment - 30 * 60_000).toISOString();
  }

  const checkInDay = typeof details.checkInDayValue === "string" ? details.checkInDayValue : "";
  const checkInTime = dateAtSgtHour(checkInDay, 9);
  if (checkInTime) return checkInTime;

  return nextSgtSlot(1, 9);
}

function dateAtSgtHour(iso: string, hour: number): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const sgt = new Date(ms + 8 * 3_600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate(), hour - 8, 0)).toISOString();
}

function nextSgtSlot(daysFromToday: number, hour: number): string {
  const sgt = new Date(Date.now() + 8 * 3_600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate() + daysFromToday, hour - 8, 0)).toISOString();
}

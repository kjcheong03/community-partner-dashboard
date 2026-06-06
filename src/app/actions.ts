"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import {
  checkpointLabel,
  nextRouteCheckpointStage,
  routeCheckpointStages,
  TRANSITIONS,
  type FulfilmentCheckpointStage,
  type FulfilmentRoute,
  type RequestStatus,
  type SupportTypeId,
} from "@/lib/contract";
import type { ScheduleAssignmentDetailsInput, ScheduleAssignmentMutationResult, ScheduleStatus } from "@/lib/schedule";
import { assigneesForWorkspace, getWorkspaceBySlug, type ScheduleKind, type WorkspaceConfig } from "@/lib/workspaces";

type StatusTarget = {
  workspaceSlug: string;
  taskId?: string | null;
  routeId?: string | null;
  next: RequestStatus;
  reason?: string;
  scheduleDetails?: ScheduleAssignmentDetailsInput;
};

type RerouteResult = {
  fromWorkspaceId: string;
  toWorkspaceId: string;
  fallbackOrgIds: string[];
};
type ActionResult = { ok: true; rerouted?: RerouteResult } | { ok: false; error: string };

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;
const SCHEDULE_SESSION_DURATION_MINUTES = 60;

type RouteCheckpointTarget = {
  workspaceSlug: string;
  routeId: string;
  stage: FulfilmentCheckpointStage;
  notes?: string;
};

type RouteCheckpointMutationResult = {
  stage: FulfilmentCheckpointStage;
  label: string;
  completedAt: string;
  actorName?: string;
  notes?: string;
};

export async function updateWorkItemStatusAction(target: StatusTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const workspace = getWorkspaceBySlug(target.workspaceSlug);
  if (!workspace) return { ok: false, error: "Unknown workspace" };
  const supabase = createSupabaseServerClient();
  const scheduleDetails = target.next === "Accepted" && workspace.scheduleKind
    ? parseScheduleDetails(target.scheduleDetails)
    : null;
  if (target.next === "Accepted" && workspace.scheduleKind && !scheduleDetails) {
    return { ok: false, error: "Schedule details are required" };
  }
  if (target.next === "Accepted" && workspace.scheduleKind && !scheduleDetails?.assigneeName) {
    return { ok: false, error: "Assignee is required" };
  }
  const assigneeError = validateWorkspaceAssignee(workspace, scheduleDetails?.assigneeName);
  if (assigneeError) return { ok: false, error: assigneeError };
  if (scheduleDetails) {
    const placementError = await validateSchedulePlacement(supabase, workspace.id, scheduleDetails.scheduledFor, scheduleDetails.assigneeName);
    if (placementError) return { ok: false, error: placementError };
  }

  let result: ActionResult;

  if (target.routeId) {
    result = await updateRouteRequestStatus(supabase, workspace, target.routeId, target.next, target.reason);
  } else if (target.taskId) {
    result = await updateTaskRequestStatus(supabase, workspace, target.taskId, target.next, target.reason);
  } else {
    return { ok: false, error: "Missing task or route id" };
  }

  if (!result.ok) return result;
  if (result.rerouted) {
    revalidatePath(`/${target.workspaceSlug}`);
    return { ok: true, rerouted: result.rerouted };
  }

  const scheduleAssignment = await ensureScheduleAssignmentForAccepted(supabase, workspace, target);
  revalidatePath(`/${target.workspaceSlug}`);
  return { ok: true, scheduleAssignment };
}

export async function advanceRouteCheckpointAction(target: RouteCheckpointTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const workspace = getWorkspaceBySlug(target.workspaceSlug);
  if (!workspace) return { ok: false, error: "Unknown workspace" };

  const supabase = createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("request_routes")
    .select("id, task_id, workspace_id, label, route_type, lifecycle")
    .eq("id", target.routeId)
    .single<{
      id: string;
      task_id: string;
      workspace_id: string;
      label: string;
      route_type: FulfilmentRoute["routeType"];
      lifecycle: RequestStatus | null;
    }>();
  if (routeError) return { ok: false, error: routeError.message };
  if (route.workspace_id !== workspace.id) return { ok: false, error: "Route is outside this workspace" };

  const { data: task, error: taskError } = await supabase
    .from("request_tasks")
    .select("support_type, details")
    .eq("id", route.task_id)
    .single<{ support_type: SupportTypeId; details: Record<string, unknown> | null }>();
  if (taskError) return { ok: false, error: taskError.message };

  const routeCheckpointInput = { supportType: task.support_type, details: task.details ?? {} };
  const routeStageInput = { label: route.label };
  const stages = routeCheckpointStages(routeCheckpointInput, routeStageInput);
  const checkpoints = await readRouteCheckpoints(supabase, target.routeId);
  const expected = nextRouteCheckpointStage(
    routeCheckpointInput,
    { ...routeStageInput, checkpoints },
  );
  if (!expected) return { ok: false, error: "This route does not use route checkpoints or is already complete" };
  if (target.stage !== expected) return { ok: false, error: `Next checkpoint must be ${checkpointLabel(expected)}` };

  const nextStatus = requestStatusForCheckpoint(target.stage, stages);
  const fromStatus = route.lifecycle ?? "Pending";
  if (nextStatus !== fromStatus) {
    const scope = route.route_type === "partner_service" ? "full" : "reduced";
    const transitionError = validateRequestTransition(scope, fromStatus, nextStatus);
    if (transitionError) return { ok: false, error: transitionError };
  }

  const completedAt = new Date().toISOString();
  const stepOrder = stages.indexOf(target.stage) + 1;
  const { data: inserted, error: insertError } = await supabase
    .from("request_route_checkpoints")
    .insert({
      route_id: target.routeId,
      stage: target.stage,
      step_order: stepOrder,
      actor_name: workspace.shortName,
      notes: target.notes?.trim() || null,
      completed_at: completedAt,
    })
    .select("stage, completed_at, actor_name, notes")
    .single<RouteCheckpointActionRow>();
  if (insertError) return { ok: false, error: insertError.message };

  if (nextStatus !== fromStatus) {
    const statusResult = await updateRouteRequestStatus(supabase, workspace, target.routeId, nextStatus, checkpointLabel(target.stage));
    if (!statusResult.ok) return statusResult;
  }

  revalidatePath(`/${target.workspaceSlug}`);
  return {
    ok: true,
    checkpoint: {
      stage: inserted.stage,
      label: checkpointLabel(inserted.stage),
      completedAt: inserted.completed_at,
      actorName: inserted.actor_name ?? undefined,
      notes: inserted.notes ?? undefined,
    } satisfies RouteCheckpointMutationResult,
  };
}

type ScheduleStatusTarget = {
  workspaceSlug: string;
  scheduleAssignmentId: string;
  next: ScheduleStatus;
};

const SCHEDULE_TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  Scheduled: ["Completed", "Cancelled", "Rescheduled"],
  "In progress": ["Completed", "Cancelled", "Rescheduled"],
  Rescheduled: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export async function updateScheduleAssignmentStatusAction(target: ScheduleStatusTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const workspace = getWorkspaceBySlug(target.workspaceSlug);
  if (!workspace) return { ok: false, error: "Unknown workspace" };

  const supabase = createSupabaseServerClient();

  const { data: assignment, error: readError } = await supabase
    .from("schedule_assignments")
    .select("status, workspace_id, task_id, route_id")
    .eq("id", target.scheduleAssignmentId)
    .single<{ status: ScheduleStatus; workspace_id: string; task_id: string | null; route_id: string | null }>();
  if (readError) return { ok: false, error: readError.message };
  if (assignment.workspace_id !== workspace.id) return { ok: false, error: "Schedule assignment is outside this workspace" };

  if (target.next !== assignment.status && !SCHEDULE_TRANSITIONS[assignment.status].includes(target.next)) {
    return { ok: false, error: `Invalid schedule transition from ${assignment.status} to ${target.next}` };
  }

  if (target.next !== assignment.status) {
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ status: target.next })
      .eq("id", target.scheduleAssignmentId);
    if (error) return { ok: false, error: error.message };
  }

  const result = await syncRequestStatusFromSchedule(supabase, workspace, assignment, target.next);
  if (!result.ok) return result;

  revalidatePath(`/${target.workspaceSlug}`);
  return { ok: true };
}

type ScheduleDetailsTarget = ScheduleAssignmentDetailsInput & {
  workspaceSlug: string;
  scheduleAssignmentId: string;
};

export async function updateScheduleAssignmentDetailsAction(target: ScheduleDetailsTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
  const workspace = getWorkspaceBySlug(target.workspaceSlug);
  if (!workspace) return { ok: false, error: "Unknown workspace" };

  const scheduledForMs = Date.parse(target.scheduledFor);
  if (Number.isNaN(scheduledForMs)) return { ok: false, error: "Scheduled time is invalid" };
  if (!target.assigneeName?.trim()) return { ok: false, error: "Assignee is required" };
  const assigneeError = validateWorkspaceAssignee(workspace, target.assigneeName);
  if (assigneeError) return { ok: false, error: assigneeError };

  const supabase = createSupabaseServerClient();
  const { data: assignment, error: readError } = await supabase
    .from("schedule_assignments")
    .select("workspace_id, scheduled_for, status, task_id, route_id")
    .eq("id", target.scheduleAssignmentId)
    .single<{ workspace_id: string; scheduled_for: string; status: ScheduleStatus; task_id: string | null; route_id: string | null }>();
  if (readError) return { ok: false, error: readError.message };
  if (assignment.workspace_id !== workspace.id) return { ok: false, error: "Schedule assignment is outside this workspace" };
  if (assignment.status === "Completed" || assignment.status === "Cancelled") {
    return { ok: false, error: "Closed schedule assignments cannot be edited" };
  }

  const scheduledFor = new Date(scheduledForMs).toISOString();
  const placementError = await validateSchedulePlacement(
    supabase,
    workspace.id,
    scheduledFor,
    target.assigneeName?.trim() || undefined,
    target.scheduleAssignmentId
  );
  if (placementError) return { ok: false, error: placementError };

  const scheduledChanged = Date.parse(assignment.scheduled_for) !== Date.parse(scheduledFor);
  const { error } = await supabase
    .from("schedule_assignments")
    .update({
      assignee_name: target.assigneeName?.trim() || null,
      scheduled_for: scheduledFor,
      notes: target.notes?.trim() || null,
      ...(scheduledChanged ? { rescheduled_from: assignment.scheduled_for, status: "Rescheduled" satisfies ScheduleStatus } : {}),
    })
    .eq("id", target.scheduleAssignmentId);
  if (error) return { ok: false, error: error.message };

  const result = await syncRequestStatusFromSchedule(supabase, workspace, assignment, scheduledChanged ? "Rescheduled" : assignment.status);
  if (!result.ok) return result;
  if (assignment.task_id) {
    await syncTaskScheduleFields(supabase, assignment.task_id, {
      assigneeName: target.assigneeName,
      scheduledFor,
      notes: target.notes,
    });
  }

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
  supabase: SupabaseServerClient,
  workspace: WorkspaceConfig,
  target: StatusTarget,
): Promise<ScheduleAssignmentMutationResult | undefined> {
  if (target.next !== "Accepted" || !workspace.scheduleKind) return undefined;
  if (!target.taskId && !target.routeId) return undefined;
  const scheduleDetails = parseScheduleDetails(target.scheduleDetails);
  if (target.scheduleDetails && !scheduleDetails) return undefined;

  const existingQuery = supabase
    .from("schedule_assignments")
    .select("id, scheduled_for, status, assignee_name, notes")
    .eq("workspace_id", workspace.id)
    .limit(1);
  const { data: existing, error: existingError } = target.routeId
    ? await existingQuery.eq("route_id", target.routeId)
    : await existingQuery.eq("task_id", target.taskId);
  if (existingError) return undefined;
  if (existing?.length) {
    if (scheduleDetails) {
      await supabase
        .from("schedule_assignments")
        .update({
          assignee_name: scheduleDetails.assigneeName || null,
          scheduled_for: scheduleDetails.scheduledFor,
          notes: scheduleDetails.notes ?? null,
        })
        .eq("id", existing[0].id);
      existing[0] = {
        ...existing[0],
        scheduled_for: scheduleDetails.scheduledFor,
        assignee_name: scheduleDetails.assigneeName || null,
        notes: scheduleDetails.notes ?? null,
      };
    }
    if (target.routeId) await updateRouteRequestStatus(supabase, workspace, target.routeId, "In progress", "Scheduled");
    else if (target.taskId) {
      await syncTaskScheduleFields(supabase, target.taskId, scheduleDetails);
      await updateTaskRequestStatus(supabase, workspace, target.taskId, "In progress", "Scheduled");
    }
    return mapScheduleAssignmentActionResult(existing[0] as ScheduleAssignmentActionRow);
  }

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
    assignee_name?: string;
  } = {
    workspace_id: workspace.id,
    scheduled_for: scheduleDetails?.scheduledFor ?? defaultScheduledFor(workspace.scheduleKind, taskDetails.details, taskDetails.scheduledFor),
    status: "Scheduled",
    notes: scheduleDetails?.notes ?? "Created when request was accepted.",
  };
  if (scheduleDetails?.assigneeName) insertRow.assignee_name = scheduleDetails.assigneeName;

  if (target.routeId) insertRow.route_id = target.routeId;
  else if (target.taskId) insertRow.task_id = target.taskId;

  const { data: inserted, error: insertError } = await supabase
    .from("schedule_assignments")
    .insert(insertRow)
    .select("id, scheduled_for, status, assignee_name, notes")
    .single<ScheduleAssignmentActionRow>();
  if (insertError) return undefined;

  if (target.routeId) await updateRouteRequestStatus(supabase, workspace, target.routeId, "In progress", "Scheduled");
  else if (target.taskId) {
    await syncTaskScheduleFields(supabase, target.taskId, scheduleDetails);
    await updateTaskRequestStatus(supabase, workspace, target.taskId, "In progress", "Scheduled");
  }

  return inserted ? mapScheduleAssignmentActionResult(inserted) : undefined;
}

type ScheduleAssignmentActionRow = {
  id: string;
  scheduled_for: string;
  status: ScheduleStatus;
  assignee_name: string | null;
  notes: string | null;
};

type RouteCheckpointActionRow = {
  stage: FulfilmentCheckpointStage;
  completed_at: string;
  actor_name: string | null;
  notes: string | null;
};

function mapScheduleAssignmentActionResult(row: ScheduleAssignmentActionRow): ScheduleAssignmentMutationResult {
  return {
    id: row.id,
    scheduledFor: row.scheduled_for,
    scheduleStatus: row.status,
    assigneeName: row.assignee_name ?? undefined,
    notes: row.notes ?? undefined,
  };
}

async function readRouteCheckpoints(supabase: SupabaseServerClient, routeId: string) {
  const { data, error } = await supabase
    .from("request_route_checkpoints")
    .select("stage, completed_at, actor_name, notes")
    .eq("route_id", routeId)
    .order("completed_at", { ascending: true });

  if (error) return [];
  return ((data ?? []) as RouteCheckpointActionRow[]).map((row) => ({
    stage: row.stage,
    label: checkpointLabel(row.stage),
    completedAt: row.completed_at,
    actorName: row.actor_name ?? undefined,
    notes: row.notes ?? undefined,
  }));
}

function requestStatusForCheckpoint(stage: FulfilmentCheckpointStage, stages: FulfilmentCheckpointStage[]): RequestStatus {
  if (stage === "accepted") return "Accepted";
  return stage === stages[stages.length - 1] ? "Completed" : "In progress";
}

function parseScheduleDetails(details?: ScheduleAssignmentDetailsInput): ScheduleAssignmentDetailsInput | null {
  if (!details) return null;
  const scheduledForMs = Date.parse(details.scheduledFor);
  if (Number.isNaN(scheduledForMs)) return null;
  return {
    scheduledFor: new Date(scheduledForMs).toISOString(),
    assigneeName: details.assigneeName?.trim() || undefined,
    notes: details.notes?.trim() || undefined,
  };
}

function validateWorkspaceAssignee(workspace: WorkspaceConfig, assigneeName?: string): string | null {
  const assignee = assigneeName?.trim();
  if (!assignee) return null;
  const roster = assigneesForWorkspace(workspace);
  if (!roster.length || roster.includes(assignee)) return null;
  return `${assignee} is not on the ${workspace.shortName} roster`;
}

async function validateSchedulePlacement(
  supabase: SupabaseServerClient,
  workspaceId: string,
  scheduledFor: string,
  assigneeName?: string,
  excludeAssignmentId?: string,
): Promise<string | null> {
  const targetStart = Date.parse(scheduledFor);
  if (Number.isNaN(targetStart)) return "Scheduled time is invalid";
  const targetEnd = targetStart + SCHEDULE_SESSION_DURATION_MINUTES * 60_000;
  if (!isWithinScheduleWindow(targetStart, targetEnd)) return "Scheduled time is outside working hours";

  const { data, error } = await supabase
    .from("schedule_assignments")
    .select("id, scheduled_for, assignee_name, status")
    .eq("workspace_id", workspaceId);
  if (error) return error.message;

  const existing = (data ?? [])
    .filter((row) => row.id !== excludeAssignmentId)
    .filter((row) => row.status !== "Cancelled")
    .flatMap((row) => {
      const start = Date.parse(row.scheduled_for);
      if (Number.isNaN(start)) return [];
      return [{
        start,
        end: start + SCHEDULE_SESSION_DURATION_MINUTES * 60_000,
        assigneeName: typeof row.assignee_name === "string" ? row.assignee_name.trim() : "",
      }];
    });

  if (existing.some((row) => intervalsOverlap(targetStart, targetEnd, row.start, row.end))) {
    return "Timeslot overlaps another session";
  }

  const assignee = assigneeName?.trim();
  if (assignee && existing.some((row) => row.assigneeName === assignee && intervalsOverlap(targetStart, targetEnd, row.start, row.end))) {
    return `${assignee} is not available at this time`;
  }

  return null;
}

function isWithinScheduleWindow(start: number, end: number): boolean {
  if (sgtDateKey(start) !== sgtDateKey(end - 1)) return false;
  return minutesSinceSgtDayStart(start) >= 9 * 60 && minutesSinceSgtDayStart(end) <= 18 * 60;
}

function sgtDateKey(ms: number): string {
  const date = new Date(ms + 8 * 3_600_000);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function minutesSinceSgtDayStart(ms: number): number {
  const date = new Date(ms + 8 * 3_600_000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function readScheduleTaskDetails(
  supabase: SupabaseServerClient,
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

async function updateRouteRequestStatus(
  supabase: SupabaseServerClient,
  workspace: WorkspaceConfig,
  routeId: string,
  next: RequestStatus,
  reason?: string,
): Promise<ActionResult> {
  const { data: route, error: routeError } = await supabase
    .from("request_routes")
    .select("lifecycle, route_type, workspace_id")
    .eq("id", routeId)
    .single<{ lifecycle: RequestStatus | null; route_type: FulfilmentRoute["routeType"]; workspace_id: string }>();
  if (routeError) return { ok: false, error: routeError.message };
  if (route.workspace_id !== workspace.id) return { ok: false, error: "Route is outside this workspace" };

  const fromStatus = route.lifecycle ?? "Pending";
  const scope = route.route_type === "partner_service" ? "full" : "reduced";
  const transitionError = validateRequestTransition(scope, fromStatus, next);
  if (transitionError) return { ok: false, error: transitionError };
  if (next === fromStatus) return { ok: true };

  const { error } = await supabase
    .from("request_routes")
    .update({ lifecycle: next })
    .eq("id", routeId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("request_status_events").insert({
    route_id: routeId,
    from_status: fromStatus,
    to_status: next,
    reason: reason ?? null,
    notes: `workspace:${workspace.id}`,
  });
  return { ok: true };
}

async function updateTaskRequestStatus(
  supabase: SupabaseServerClient,
  workspace: WorkspaceConfig,
  taskId: string,
  next: RequestStatus,
  reason?: string,
): Promise<ActionResult> {
  const { data: task, error: taskError } = await supabase
    .from("request_tasks")
    .select("status, primary_org_id, fallback_org_ids")
    .eq("id", taskId)
    .single<{ status: RequestStatus; primary_org_id: string | null; fallback_org_ids: string[] | null }>();
  if (taskError) return { ok: false, error: taskError.message };
  if (task.primary_org_id !== workspace.id && !(task.fallback_org_ids ?? []).includes(workspace.id)) {
    return { ok: false, error: "Task is outside this workspace" };
  }

  const fromStatus = task.status;
  const transitionError = validateRequestTransition("full", fromStatus, next);
  if (transitionError) return { ok: false, error: transitionError };
  if (next === fromStatus) return { ok: true };

  if (next === "Rejected" && task.primary_org_id === workspace.id) {
    const fallbackIds = (task.fallback_org_ids ?? []).filter((id) => id && id !== workspace.id);
    const nextPrimary = fallbackIds[0];
    if (nextPrimary) {
      const remainingFallbacks = fallbackIds.slice(1);
      const { error } = await supabase
        .from("request_tasks")
        .update({
          primary_org_id: nextPrimary,
          fallback_org_ids: remainingFallbacks,
          status: "Pending" satisfies RequestStatus,
          rejection_reason: null,
          assigned_to: null,
          scheduled_for: null,
          partner_notes: null,
        })
        .eq("id", taskId);
      if (error) return { ok: false, error: error.message };

      await supabase.from("request_status_events").insert({
        task_id: taskId,
        from_status: fromStatus,
        to_status: "Pending" satisfies RequestStatus,
        reason: reason ?? null,
        notes: `rerouted_from:${workspace.id};rerouted_to:${nextPrimary}`,
      });

      return {
        ok: true,
        rerouted: {
          fromWorkspaceId: workspace.id,
          toWorkspaceId: nextPrimary,
          fallbackOrgIds: remainingFallbacks,
        },
      };
    }
  }

  const { error } = await supabase
    .from("request_tasks")
    .update({
      status: next,
      rejection_reason: next === "Rejected" ? reason ?? null : null,
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("request_status_events").insert({
    task_id: taskId,
    from_status: fromStatus,
    to_status: next,
    reason: reason ?? null,
    notes: `workspace:${workspace.id}`,
  });
  return { ok: true };
}

async function syncTaskScheduleFields(
  supabase: SupabaseServerClient,
  taskId: string,
  details: ScheduleAssignmentDetailsInput | null | undefined,
) {
  if (!details) return;
  await supabase
    .from("request_tasks")
    .update({
      assigned_to: details.assigneeName?.trim() || null,
      scheduled_for: details.scheduledFor,
      partner_notes: details.notes?.trim() || null,
    })
    .eq("id", taskId);
}

function validateRequestTransition(scope: "full" | "reduced", fromStatus: RequestStatus, next: RequestStatus): string | null {
  if (next === fromStatus) return null;
  if (!TRANSITIONS[scope][fromStatus].includes(next)) {
    return `Invalid ${scope} transition from ${fromStatus} to ${next}`;
  }
  return null;
}

function scheduleStatusToRequestStatus(status: ScheduleStatus): RequestStatus | null {
  switch (status) {
    case "Scheduled":
    case "Rescheduled":
    case "In progress":
      return "In progress";
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

async function syncRequestStatusFromSchedule(
  supabase: SupabaseServerClient,
  workspace: WorkspaceConfig,
  assignment: { task_id: string | null; route_id: string | null },
  scheduleStatus: ScheduleStatus,
): Promise<ActionResult> {
  const requestStatus = scheduleStatusToRequestStatus(scheduleStatus);
  if (!requestStatus) return { ok: true };

  if (assignment.route_id) {
    return updateRouteRequestStatus(supabase, workspace, assignment.route_id, requestStatus, `Schedule ${scheduleStatus}`);
  }
  if (assignment.task_id) {
    return updateTaskRequestStatus(supabase, workspace, assignment.task_id, requestStatus, `Schedule ${scheduleStatus}`);
  }

  return { ok: false, error: "Schedule assignment has no request target" };
}

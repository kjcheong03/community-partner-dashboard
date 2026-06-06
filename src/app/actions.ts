"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { TRANSITIONS, type FulfilmentRoute, type RequestStatus } from "@/lib/contract";

type StatusTarget = {
  workspaceSlug: string;
  taskId?: string | null;
  routeId?: string | null;
  next: RequestStatus;
  reason?: string;
};

export async function updateWorkItemStatusAction(target: StatusTarget) {
  if (!hasSupabaseServerConfig()) return { ok: false, error: "Supabase is not configured" };
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
  } else {
    return { ok: false, error: "Missing task or route id" };
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

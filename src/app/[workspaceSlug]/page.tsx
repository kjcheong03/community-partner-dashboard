import { notFound } from "next/navigation";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";
import type { InventoryRow } from "@/components/kit/InventoryTable";
import type { RequestSession, RequestTaskSession } from "@/lib/contract";
import type { DashboardScheduleAssignment } from "@/lib/schedule";
import { WORKSPACES, getWorkspaceBySlug } from "@/lib/workspaces";
import { fetchWorkspaceDashboardData } from "@/lib/supabase/dashboard";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return WORKSPACES.map((workspace) => ({ workspaceSlug: workspace.slug }));
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = getWorkspaceBySlug(workspaceSlug);

  if (!workspace) notFound();

  const dashboardData = await fetchWorkspaceDashboardData(workspace);

  return (
    <WorkspaceDashboard
      key={dashboardDataKey(workspace.slug, dashboardData?.sessions, dashboardData?.inventoryRows, dashboardData?.scheduleAssignments)}
      workspace={workspace}
      initialSessions={dashboardData?.sessions}
      initialInventoryRows={dashboardData?.inventoryRows}
      initialScheduleAssignments={dashboardData?.scheduleAssignments}
    />
  );
}

function dashboardDataKey(
  workspaceSlug: string,
  sessions?: RequestSession[],
  inventoryRows?: InventoryRow[] | null,
  scheduleAssignments?: DashboardScheduleAssignment[] | null,
) {
  const sessionKey = sessions
    ? sessions.map((session) => `${session.id}:${session.overallStatus}:${session.tasks.map(taskKey).join(",")}`).join("|")
    : "mock";
  const inventoryKey = inventoryRows
    ? inventoryRows.map((row) => `${row.id ?? row.item}:${row.available}:${row.reserved}:${row.fulfilled ?? 0}:${row.lastUpdated}`).join("|")
    : "no-inventory";
  const scheduleKey = scheduleAssignments
    ? scheduleAssignments.map((assignment) => `${assignment.id}:${assignment.scheduledFor}:${assignment.scheduleStatus}:${assignment.assigneeName ?? ""}`).join("|")
    : "no-schedule";
  return `${workspaceSlug}:${sessionKey}:${inventoryKey}:${scheduleKey}`;
}

function taskKey(task: RequestTaskSession) {
  const routes = (task.fulfilmentRoutes ?? [])
    .map((route) => `${route.label}:${route.lifecycle ?? "Pending"}`)
    .join(",");
  return `${task.id}:${task.status}:${routes}`;
}

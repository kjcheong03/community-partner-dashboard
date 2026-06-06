import type { RequestStatus, SupportTypeId } from "@/lib/contract";

export type ScheduleStatus = "Scheduled" | "In progress" | "Completed" | "Cancelled" | "Rescheduled";

export type DashboardScheduleAssignment = {
  id: string;
  workspaceId: string;
  taskId?: string;
  routeId?: string;
  routeLabel?: string;
  supportType: SupportTypeId;
  requestStatus: RequestStatus;
  assigneeName?: string;
  scheduledFor: string;
  scheduleStatus: ScheduleStatus;
  rescheduledFrom?: string;
  notes?: string;
  sessionId: string;
};

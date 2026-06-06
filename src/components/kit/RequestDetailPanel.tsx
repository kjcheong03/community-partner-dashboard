"use client";

import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FulfilmentCheckpointStage, RequestStatus, WorkItem } from "@/lib/contract";
import {
  checkpointLabel,
  nextRouteCheckpointStage,
  routeCheckpointStages,
  routeDisplayStatus,
  routeStatus,
  requestRef,
  supportTypeLabels,
  taskDisplayStatus,
} from "@/lib/contract";
import { URGENCY_STYLES } from "./theme";
import { costForItem, deriveUrgency, detailRows, formatSubmitted, neededByLabel } from "./format";
import StatusBadge from "./StatusBadge";
import StatusActionBar from "./StatusActionBar";

const shortRequestRef = (sessionId: string) => requestRef(sessionId).replace(/^REQ-/, "#");

type Props = {
  item: WorkItem;
  onStatusChange?: (item: WorkItem, next: RequestStatus, reason?: string) => void;
  onCheckpointAdvance?: (item: WorkItem, stage: FulfilmentCheckpointStage) => void;
  actionBusy?: boolean;
  onClose?: () => void;
  className?: string;
};

export default function RequestDetailPanel({ item, onStatusChange, onCheckpointAdvance, actionBusy, onClose, className }: Props) {
  const { task, session, route } = item;
  const urgency = deriveUrgency(task, session.createdAt);
  const cost = costForItem(item);
  const caregiverEstimate = caregiverEstimateText(cost);
  const rows = detailRows(task, route?.label);
  const neededBy = neededByLabel(task, session.createdAt);
  const displayStatus = route ? routeDisplayStatus(task, route) : taskDisplayStatus(task);
  const checkpointStages = route ? routeCheckpointStages(task, route) : [];
  const nextCheckpoint = route ? nextRouteCheckpointStage(task, route) : null;
  const usesCheckpoints = Boolean(route && checkpointStages.length);
  const usesScheduleFlow = !usesCheckpoints && usesScheduleWorkflow(item);

  return (
    <div className={cn("ops-card flex h-full min-h-0 flex-col", className)}>
      {/* Slim header — identity lives in Contact below, not repeated here. */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{shortRequestRef(session.id)}</span>
            <StatusBadge status={displayStatus} />
            <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium", URGENCY_STYLES[urgency].pill)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", URGENCY_STYLES[urgency].dot)} /> {urgency}
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold text-slate-800">{route ? route.label : supportTypeLabels[item.supportType]}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
            <Clock size={11} /> Submitted {formatSubmitted(session.createdAt)}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {/* Contact first */}
        <Section title="Contact">
          <div className="space-y-1.5">
            <Row label="Submitted by">{session.caregiverName}{session.relationship ? ` (${session.relationship})` : ""}</Row>
            <Row label="Care recipient">{session.careRecipientName}</Row>
            <Row label="Reach via">{session.contactMethod}</Row>
            <Row label="Contact">{session.contactNumber}</Row>
            <Row label="Area">{session.generalArea ?? "—"}</Row>
            {session.address && <Row label="Address">{session.address}</Row>}
            {session.postalCode && <Row label="Postal code">{session.postalCode}</Row>}
          </div>
        </Section>

        {/* Request details */}
        <Section title="Request details">
          <div className="space-y-2.5">
            <Row label="Needed by"><span className="font-semibold">{neededBy}</span></Row>
            {rows.map((r) =>
              r.long ? (
                <LongField key={r.label} label={r.label}>{r.value}</LongField>
              ) : (
                <Row key={r.label} label={r.label}>{r.value}</Row>
              )
            )}
            {caregiverEstimate && <Row label="Caregiver-facing estimate">{caregiverEstimate}</Row>}
            {task.rejectionReason && (
              <LongField label="Rejection reason" tone="danger">{task.rejectionReason}</LongField>
            )}
          </div>
        </Section>

        {usesCheckpoints && route && (
          <Section title="Fulfilment checkpoints">
            <CheckpointTimeline
              item={item}
              stages={checkpointStages}
            />
          </Section>
        )}

        {usesScheduleFlow && (
          <Section title="Request flow">
            <ScheduleFlowTimeline item={item} />
          </Section>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        {usesCheckpoints ? (
          <CheckpointAction
            item={item}
            nextStage={nextCheckpoint}
            busy={actionBusy}
            onAdvance={onCheckpointAdvance}
          />
        ) : (
          <StatusActionBar transitions={item.transitions} onChange={(next, reason) => onStatusChange?.(item, next, reason)} />
        )}
      </div>
    </div>
  );
}

function ScheduleFlowTimeline({ item }: { item: WorkItem }) {
  const scheduledFor = item.task.scheduledFor;
  const scheduleStatus = item.task.scheduleStatus;
  const hasSchedule = Boolean(scheduledFor) || item.status === "In progress" || item.status === "Completed" || item.status === "Cancelled";
  const finalStatus = item.status === "Rejected" || item.status === "Cancelled" ? item.status : "Completed";
  const finalComplete = item.status === "Completed" || item.status === "Cancelled" || item.status === "Rejected";
  const scheduledLabel = scheduledFor
    ? `${scheduleStatus === "Rescheduled" ? "Rescheduled" : "Scheduled"} for ${formatWorkflowTime(scheduledFor)}`
    : "Scheduled";
  const steps = [
    {
      key: "pending",
      label: "Pending",
      completedAt: item.session.createdAt,
      completed: hasSchedule || finalComplete,
      active: !hasSchedule && !finalComplete,
    },
    ...(scheduleStatus === "Rescheduled" && item.task.rescheduledFrom
      ? [{
          key: "original-schedule",
          label: `Scheduled for ${formatWorkflowTime(item.task.rescheduledFrom)}`,
          completed: true,
          active: false,
        }]
      : []),
    {
      key: "scheduled",
      label: scheduledLabel,
      completed: hasSchedule,
      active: hasSchedule && !finalComplete,
    },
    {
      key: "final",
      label: finalStatus,
      completed: finalComplete,
      active: false,
    },
  ];

  return <WorkflowTimeline steps={steps} />;
}

function CheckpointTimeline({
  item,
  stages,
}: {
  item: WorkItem;
  stages: FulfilmentCheckpointStage[];
}) {
  const route = item.route;
  if (!route) return null;
  const checkpoints = route.checkpoints ?? [];
  const completed = new Map(checkpoints.map((checkpoint) => [checkpoint.stage, checkpoint]));
  const rawStatus = routeStatus(route);
  const pendingComplete = checkpoints.length > 0 || rawStatus !== "Pending";
  const steps = [
    {
      key: "pending",
      label: "Pending",
      completedAt: item.session.createdAt,
      notes: undefined,
      completed: pendingComplete,
      active: !pendingComplete,
    },
    ...stages.map((stage) => {
      const checkpoint = completed.get(stage);
      return {
        key: stage,
        label: checkpoint?.label ?? checkpointLabel(stage),
        completedAt: checkpoint?.completedAt,
        notes: checkpoint?.notes,
        completed: Boolean(checkpoint),
        active: false,
      };
    }),
  ];

  return (
    <WorkflowTimeline steps={steps} />
  );
}

type WorkflowStep = {
  key: string;
  label: string;
  completedAt?: string;
  notes?: string;
  completed: boolean;
  active: boolean;
};

function WorkflowTimeline({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="space-y-0.5">
      {steps.map((step, index) => (
        <div key={step.key} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                step.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : step.active
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-300"
              )}
            >
              {step.completed ? <Check size={12} strokeWidth={2.5} /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={cn("h-9 w-px", step.completed ? "bg-emerald-200" : "bg-slate-200")} />
            )}
          </div>
          <div className="pb-3">
            <div className="flex items-start justify-between gap-3 text-sm">
              <p className={cn("font-medium", step.completed || step.active ? "text-slate-800" : "text-slate-400")}>{step.label}</p>
              {step.completedAt && <p className="shrink-0 text-xs text-slate-400">{formatCheckpointTime(step.completedAt)}</p>}
            </div>
            {step.notes && <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CheckpointAction({
  item,
  nextStage,
  busy,
  onAdvance,
}: {
  item: WorkItem;
  nextStage: FulfilmentCheckpointStage | null;
  busy?: boolean;
  onAdvance?: (item: WorkItem, stage: FulfilmentCheckpointStage) => void;
}) {
  if (!nextStage) return <p className="text-xs text-slate-400">No further actions — this item is closed.</p>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onAdvance?.(item, nextStage)}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Working..." : checkpointActionLabel(nextStage, item)}
    </button>
  );
}

function checkpointActionLabel(stage: FulfilmentCheckpointStage, item: WorkItem): string {
  if (stage === "accepted") return "Accept";
  if (stage === "meal_plan_confirmed") return "Confirm meal plan";
  if (stage === "meal_preparing") return "Add to MOW schedule";
  if (stage === "packing") return "Start packing";
  if (stage === "ready_for_pickup") return "Ready for pickup";
  if (stage === "out_for_delivery") return "Out for delivery";
  if (stage === "completed" && item.route?.label === "Cooked meals") return "Complete service";
  if (stage === "completed") return "Complete";
  return checkpointLabel(stage);
}

function formatCheckpointTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function formatWorkflowTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-SG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function usesScheduleWorkflow(item: WorkItem): boolean {
  return item.kind === "partner-task" && (item.supportType === "welfare" || item.supportType === "transport" || item.supportType === "referral");
}

function caregiverEstimateText(cost: { text: string; tone: string }): string | null {
  if (cost.tone === "free" || cost.tone === "review") return null;
  const text = cost.text.trim();
  return text && text !== "—" ? text : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4">
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{children}</span>
    </div>
  );
}

// Stacked field for free-text answers — same label typography as Row, with extra
// vertical room so it reads as a distinct block among the tight short rows.
function LongField({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <div className="space-y-1 py-2">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={cn("text-sm leading-relaxed", tone === "danger" ? "text-red-700" : "text-slate-700")}>{children}</p>
    </div>
  );
}

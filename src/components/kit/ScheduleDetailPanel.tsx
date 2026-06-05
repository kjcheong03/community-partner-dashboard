"use client";

import { CalendarClock, CheckCircle2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkItem } from "@/lib/contract";
import { supportTypeLabels } from "@/lib/contract";
import { detailRows, formatSubmitted, neededByLabel } from "./format";
import StatusBadge from "./StatusBadge";

type Props = {
  item: WorkItem;
  onClose?: () => void;
  className?: string;
};

export default function ScheduleDetailPanel({ item, onClose, className }: Props) {
  const { task, session, route } = item;
  const title = route ? route.label : supportTypeLabels[item.supportType];
  const scheduledFor = typeof task.scheduledFor === "string" ? task.scheduledFor : "";
  const assignee = task.assignedTo?.trim() || "Unassigned";
  const scheduleState = item.status === "In progress" ? "In progress" : item.status === "Completed" ? "Completed" : "Scheduled";
  const rows = detailRows(task, route?.label);
  const dispatchRows = dispatchRowsForItem(item, scheduledFor, assignee);

  return (
    <div className={cn("ops-card flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{session.id.replace("req-", "#")}</span>
            <StatusBadge status={scheduleState} />
          </div>
          <h3 className="mt-1.5 font-semibold text-slate-800">{title}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
            <CalendarClock size={11} /> {formatScheduleTime(scheduledFor)}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        <Section title="Dispatch">
          <div className="space-y-1.5">
            {dispatchRows.map((row) => (
              <Row key={row.label} label={row.label}>{row.value}</Row>
            ))}
            <Row label="Request status">{item.status}</Row>
            <Row label="Needed by">{neededByLabel(task, session.createdAt)}</Row>
          </div>
        </Section>

        <Section title="Request context">
          <div className="space-y-1.5">
            <Row label="Care recipient">{session.careRecipientName}</Row>
            <Row label="Submitted by">{session.caregiverName}{session.relationship ? ` (${session.relationship})` : ""}</Row>
            <Row label="Submitted">{formatSubmitted(session.createdAt)}</Row>
            <Row label="Area">{session.generalArea ?? "—"}</Row>
            {session.address && <Row label="Address">{session.address}</Row>}
          </div>
        </Section>

        <Section title="Task notes">
          <div className="space-y-2">
            {rows.map((r) =>
              r.long ? (
                <LongField key={r.label} label={r.label}>{r.value}</LongField>
              ) : (
                <Row key={r.label} label={r.label}>{r.value}</Row>
              )
            )}
          </div>
        </Section>
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        {item.status === "Completed" ? (
          <p className="text-xs text-slate-400">This scheduled visit is complete.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
              <CheckCircle2 size={13} /> Complete
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw size={13} /> Reschedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function dispatchRowsForItem(item: WorkItem, scheduledFor: string, assignee: string) {
  const details = item.task.details ?? {};
  if (item.supportType === "transport") {
    return [
      { label: "Assigned driver", value: assignee },
      { label: "Scheduled pickup", value: formatScheduleTime(scheduledFor) },
      { label: "Appointment", value: typeof details.appointmentDateTime === "string" ? formatScheduleTime(details.appointmentDateTime) : "—" },
      { label: "Pickup area", value: String(details.pickupArea ?? item.session.generalArea ?? "—") },
      { label: "Destination", value: String(details.destination ?? "—") },
    ];
  }

  return [
    { label: "Assigned to", value: assignee },
    { label: "Check method", value: String(details.checkMethod ?? "—") },
    { label: "Scheduled for", value: formatScheduleTime(scheduledFor) },
  ];
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

function LongField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 py-1">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-right text-sm font-medium leading-relaxed text-slate-700">{children}</p>
    </div>
  );
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

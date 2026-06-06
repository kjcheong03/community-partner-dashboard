"use client";

import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestStatus, WorkItem } from "@/lib/contract";
import { supportTypeLabels } from "@/lib/contract";
import { URGENCY_STYLES } from "./theme";
import { costForItem, deriveUrgency, detailRows, formatSubmitted, neededByLabel } from "./format";
import StatusBadge from "./StatusBadge";
import StatusActionBar from "./StatusActionBar";

type Props = {
  item: WorkItem;
  onStatusChange?: (item: WorkItem, next: RequestStatus, reason?: string) => void;
  onClose?: () => void;
  className?: string;
};

export default function RequestDetailPanel({ item, onStatusChange, onClose, className }: Props) {
  const { task, session, route } = item;
  const urgency = deriveUrgency(task, session.createdAt);
  const cost = costForItem(item);
  const caregiverEstimate = caregiverEstimateText(cost);
  const rows = detailRows(task, route?.label);
  const neededBy = neededByLabel(task, session.createdAt);

  return (
    <div className={cn("ops-card flex h-full min-h-0 flex-col", className)}>
      {/* Slim header — identity lives in Contact below, not repeated here. */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{session.id.replace("req-", "#")}</span>
            <StatusBadge status={item.status} />
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
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <StatusActionBar transitions={item.transitions} onChange={(next, reason) => onStatusChange?.(item, next, reason)} />
      </div>
    </div>
  );
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

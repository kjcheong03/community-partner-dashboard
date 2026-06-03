"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import type { HelpRequest, Status } from "@/lib/types";
import { cn, urgencyColor, statusColor, formatDateTime } from "@/lib/utils";
import ActivityTimeline from "./ActivityTimeline";

type Props = {
  request: HelpRequest;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<HelpRequest>) => void;
};

const TEAMS = [
  "Volunteer Team A",
  "Volunteer Team B",
  "Outreach Team",
  "Pharmacy Partner",
  "Transport Partner",
];

const REROUTE_OPTIONS = [
  "SG Cares Volunteer Centre",
  "Silver Generation Team",
  "Pharmacy Partner",
  "Clinic Partner",
  "Transport Partner",
];

const RISK_COLORS: Record<string, string> = {
  "Living Alone": "bg-red-50 text-red-700 border-red-100",
  "Limited Mobility": "bg-amber-50 text-amber-700 border-amber-100",
  "Chronic Illness": "bg-orange-50 text-orange-700 border-orange-100",
  "Medication Dependent": "bg-purple-50 text-purple-700 border-purple-100",
  "Language Support Needed": "bg-blue-50 text-blue-700 border-blue-100",
};

export default function RequestDetailDrawer({ request, onClose, onUpdate }: Props) {
  const [showRerouteDialog, setShowRerouteDialog] = useState(false);
  const [rerouteTarget, setRerouteTarget] = useState(REROUTE_OPTIONS[0]);

  const now = () => new Date().toISOString();

  function advanceStatus() {
    const progression: Record<string, Status> = {
      New: "Received",
      Received: "Accepted",
      Accepted: "In Progress",
      "In Progress": "Fulfilled",
    };
    const next = progression[request.status];
    if (!next) return;

    const actionLabels: Record<string, string> = {
      Received: "Received",
      Accepted: "Accepted",
      "In Progress": "Marked In Progress",
      Fulfilled: "Marked Fulfilled",
    };

    onUpdate(request.id, {
      status: next,
      activityLog: [
        ...request.activityLog,
        { timestamp: now(), action: actionLabels[next] },
      ],
    });
  }

  function markUnableToFulfil() {
    onUpdate(request.id, {
      status: "Unable To Fulfil",
      activityLog: [
        ...request.activityLog,
        { timestamp: now(), action: "Marked Unable To Fulfil" },
      ],
    });
  }

  function assignTeam(team: string) {
    onUpdate(request.id, {
      assignedTeam: team,
      activityLog: [
        ...request.activityLog,
        { timestamp: now(), action: `Assigned to ${team}` },
      ],
    });
  }

  function confirmReroute() {
    onUpdate(request.id, {
      status: "Rerouted",
      assignedOrganisation: rerouteTarget,
      activityLog: [
        ...request.activityLog,
        { timestamp: now(), action: `Rerouted to ${rerouteTarget}` },
      ],
    });
    setShowRerouteDialog(false);
  }

  const nextActionLabel: Record<string, string> = {
    New: "Accept Request",
    Received: "Accept Request",
    Accepted: "Mark In Progress",
    "In Progress": "Mark Fulfilled",
  };

  const canAdvance = request.status in nextActionLabel;
  const canUnfulfil = ["Accepted", "In Progress"].includes(request.status);
  const canReroute = !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(request.status);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{request.id}</span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor(request.status))}>
              {request.status}
            </span>
          </div>
          <h3 className="font-semibold text-slate-800 mt-1">{request.helpType}</h3>
          <p className="text-sm text-slate-500">{request.area} · {request.topic}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {/* Request info */}
        <section className="px-6 py-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Request Information</h4>
          <div className="space-y-2 text-sm">
            <Row label="Urgency">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", urgencyColor(request.urgency))}>
                {request.urgency}
              </span>
            </Row>
            <Row label="Topic">{request.topic}</Row>
            <Row label="Location">{request.area}</Row>
            <Row label="Submitted">{formatDateTime(request.submittedAt)}</Row>
            <Row label="Assigned To">{request.assignedOrganisation}</Row>
            {request.assignedTeam && <Row label="Team">{request.assignedTeam}</Row>}
          </div>
        </section>

        {/* Risk factors */}
        {request.riskFactors.length > 0 && (
          <section className="px-6 py-4 border-b border-slate-100">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Risk Factors</h4>
            <div className="flex flex-wrap gap-1.5">
              {request.riskFactors.map((rf) => (
                <span
                  key={rf}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full border",
                    RISK_COLORS[rf] ?? "bg-slate-50 text-slate-600 border-slate-200"
                  )}
                >
                  {rf}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Caregiver notes */}
        <section className="px-6 py-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Caregiver Notes</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{request.notes}</p>
        </section>

        {/* Recommended action */}
        <section className="px-6 py-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recommended Action</h4>
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            {request.urgency === "High"
              ? "Prioritise immediate response. Assign a team and begin coordination."
              : request.urgency === "Medium"
              ? "Schedule response within the next 2 hours. Confirm team availability."
              : "Queue for routine handling. Assign when capacity allows."}
          </div>
        </section>

        {/* Team assignment */}
        <section className="px-6 py-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Assign Team</h4>
          <div className="relative">
            <select
              value={request.assignedTeam ?? ""}
              onChange={(e) => assignTeam(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-700"
            >
              <option value="" disabled>Select a team...</option>
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </section>

        {/* Workflow actions */}
        <section className="px-5 py-4 border-b border-slate-100 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Workflow Actions</h4>
          {canAdvance && (
            <button
              onClick={advanceStatus}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {nextActionLabel[request.status]}
            </button>
          )}
          {canUnfulfil && (
            <button
              onClick={markUnableToFulfil}
              className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Unable To Fulfil
            </button>
          )}
          {canReroute && (
            <button
              onClick={() => setShowRerouteDialog(true)}
              className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Reroute Request
            </button>
          )}
          {!canAdvance && !canUnfulfil && !canReroute && (
            <p className="text-sm text-slate-400 text-center py-2">No further actions available.</p>
          )}
        </section>

        {/* Activity timeline */}
        <section className="px-6 py-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Activity Log</h4>
          <ActivityTimeline entries={request.activityLog} />
        </section>
      </div>

      {/* Reroute confirmation dialog */}
      {showRerouteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-800 mb-2">Reroute Request</h3>
            <p className="text-sm text-slate-500 mb-4">Select the organisation to reroute {request.id} to.</p>
            <select
              value={rerouteTarget}
              onChange={(e) => setRerouteTarget(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {REROUTE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRerouteDialog(false)}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReroute}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700"
              >
                Confirm Reroute
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 font-medium">{children}</span>
    </div>
  );
}

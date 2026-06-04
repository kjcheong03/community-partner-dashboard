"use client";

import { X, ChevronDown, AlertTriangle, User, HeartPulse, MapPin, Flag, Building2, Users } from "lucide-react";
import type { HelpRequest, Status } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { getOrg, teamsForOrg } from "@/lib/orgs";
import { cn, urgencyColor, statusColor } from "@/lib/utils";
import { nearestFacility, ownFacilities, clinics, ownFacilityLabel } from "@/data/facilities";
import ActivityTimeline from "./ActivityTimeline";

type Props = {
  request: HelpRequest;
  org: OrgId;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<HelpRequest>) => void;
};

const STATUS_OPTIONS: Status[] = [
  "New",
  "Received",
  "Accepted",
  "In Progress",
  "Fulfilled",
  "Unable To Fulfil",
  "Rerouted",
];

const RISK_COLORS: Record<string, string> = {
  "Living Alone": "bg-red-50 text-red-700 border-red-100",
  "Limited Mobility": "bg-amber-50 text-amber-700 border-amber-100",
  "Chronic Illness": "bg-orange-50 text-orange-700 border-orange-100",
  "Language Support Needed": "bg-blue-50 text-blue-700 border-blue-100",
  "Financial Strain": "bg-green-50 text-green-700 border-green-100",
  "No Caregiver": "bg-purple-50 text-purple-700 border-purple-100",
  "Fever Symptoms": "bg-rose-50 text-rose-700 border-rose-100",
  "Isolation Risk": "bg-slate-50 text-slate-700 border-slate-200",
  "Caregiver Unavailable": "bg-cyan-50 text-cyan-700 border-cyan-100",
};

export default function RequestDetailDrawer({ request, org, onClose, onUpdate }: Props) {
  const now = () => new Date().toISOString();
  const nearestOwn = nearestFacility(request.area, ownFacilities(org));
  const nearestClinic = nearestFacility(request.area, clinics());
  const teamOptions = teamsForOrg(org);

  function changeStatus(next: Status) {
    if (next === request.status) return;
    onUpdate(request.id, {
      status: next,
      activityLog: [...request.activityLog, { timestamp: now(), action: `Status set to ${next}` }],
    });
  }

  function assignTeam(team: string) {
    onUpdate(request.id, {
      assignedTeam: team,
      assignedOrganisation: org === "AIC" ? request.assignedOrganisation : getOrg(org).name,
      activityLog: [...request.activityLog, { timestamp: now(), action: `Assigned to ${team}`, actor: org }],
    });
  }

  function toggleCareReview() {
    const next = !request.flaggedForCareReview;
    onUpdate(request.id, {
      flaggedForCareReview: next,
      activityLog: [
        ...request.activityLog,
        { timestamp: now(), action: next ? "Flagged for care review" : "Removed from care review", actor: "AIC" },
      ],
    });
  }

  function routeUnit(unit: string) {
    onUpdate(request.id, {
      assignedUnit: unit,
      assignedOrganisation: org === "AIC" ? request.assignedOrganisation : getOrg(org).name,
      activityLog: [...request.activityLog, { timestamp: now(), action: `Routed to assigned unit: ${unit}`, actor: org }],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <aside
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative bg-white w-full max-w-[460px] h-full shadow-2xl border-l border-slate-200 flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{request.id}</span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor(request.status))}>
                {request.status}
              </span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", urgencyColor(request.urgency))}>
                {request.urgency}
              </span>
            </div>
            <h3 className="font-semibold text-slate-800 mt-1.5">{request.helpType}</h3>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <MapPin size={12} /> {request.area} · {request.topic}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <Section title="Care Recipient" icon={<User size={13} />}>
            <Row label="Name">{request.recipient.name}</Row>
            <Row label="Age">{request.recipient.age}</Row>
            <Row label="Language">{request.recipient.language}</Row>
            <Row label="Mobility">{request.recipient.mobility}</Row>
          </Section>

          {(request.recipient.conditions.length > 0 || request.recipient.allergies.length > 0) && (
            <Section title="Health Notes" icon={<HeartPulse size={13} />}>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Conditions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {request.recipient.conditions.length === 0 ? (
                      <span className="text-xs text-slate-400">None recorded</span>
                    ) : (
                      request.recipient.conditions.map((c) => (
                        <span key={c} className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {request.recipient.allergies.length === 0 ? (
                      <span className="text-xs text-slate-400">None recorded</span>
                    ) : (
                      request.recipient.allergies.map((a) => (
                        <span key={a} className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                          <AlertTriangle size={10} /> {a}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section title="Caregiver" icon={<User size={13} />}>
            <Row label="Name">{request.caregiver.name}</Row>
            <Row label="Relationship">{request.caregiver.relationship}</Row>
            <Row label="Language">{request.caregiver.language}</Row>
            <Row label="Contact">{request.caregiver.contactMethod}</Row>
          </Section>

          {request.helpTags.length > 0 && (
            <Section title="Help Needed">
              <div className="flex flex-wrap gap-1.5">
                {request.helpTags.map((t) => (
                  <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {t}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {request.riskFactors.length > 0 && (
            <Section title="Risk Factors">
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
            </Section>
          )}

          <Section title="Case Notes">
            <p className="text-sm text-slate-600 leading-relaxed">{request.notes}</p>
          </Section>

          <Section title="Nearby" icon={<MapPin size={13} />}>
            <div className="space-y-2">
              {nearestOwn && (
                <div className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Nearest {ownFacilityLabel(org)}</p>
                    <p className="text-slate-700 font-medium">{nearestOwn.facility.name}</p>
                    <p className="text-xs text-slate-500">{nearestOwn.facility.info}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{nearestOwn.km.toFixed(1)} km</span>
                </div>
              )}
              {nearestClinic && (
                <div className="flex items-start justify-between gap-2 text-sm pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">Nearest clinic / hospital</p>
                    <p className="text-slate-700 font-medium">{nearestClinic.facility.name}</p>
                    <p className="text-xs text-slate-500">{nearestClinic.facility.info} · {nearestClinic.facility.hours}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{nearestClinic.km.toFixed(1)} km</span>
                </div>
              )}
            </div>
          </Section>

          {org === "AIC" ? (
            <Section title="Care Oversight" icon={<Flag size={13} />}>
              <Field label="Routed to partner">
                <p className="text-sm text-slate-700">{request.assignedOrganisation}</p>
              </Field>
              <Field label="Assigned unit">
                <p className="text-sm text-slate-700">{request.assignedUnit ?? "Not assigned"}</p>
              </Field>
              {request.outcome && (
                <Field label="Outcome">
                  <p className="text-sm text-slate-700">{request.outcome}</p>
                </Field>
              )}
              <button
                onClick={toggleCareReview}
                className={cn(
                  "w-full mt-1 flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-3 py-2 border transition-colors",
                  request.flaggedForCareReview
                    ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                    : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
                )}
              >
                <Flag size={14} />
                {request.flaggedForCareReview ? "On care-review watch list - remove" : "Flag for Care Review"}
              </button>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                AIC tracks cross-partner load and long-term care follow-up. Partner teams handle unit assignment and
                operational status updates.
              </p>
            </Section>
          ) : (
            <Section title="Coordination" icon={<Building2 size={13} />}>
              <Field label="Status">
                <Dropdown value={request.status} onChange={(v) => changeStatus(v as Status)} options={STATUS_OPTIONS} />
              </Field>
              <Field label="Assigned Unit">
                <Dropdown
                  value={request.assignedUnit ?? ""}
                  onChange={routeUnit}
                  options={ownFacilities(org).map((f) => f.name)}
                  placeholder="Route to unit..."
                />
              </Field>
              {teamOptions.length > 0 && (
                <Field label="Assigned Team">
                  <Dropdown
                    value={request.assignedTeam ?? ""}
                    onChange={assignTeam}
                    options={teamOptions}
                    placeholder="Select team..."
                  />
                </Field>
              )}
            </Section>
          )}

          <Section title="Activity Log" icon={<Users size={13} />}>
            <ActivityTimeline entries={request.activityLog} />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-slate-100">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        {icon} {title}
      </h4>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 font-medium text-right">{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

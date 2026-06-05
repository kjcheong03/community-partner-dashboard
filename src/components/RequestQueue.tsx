"use client";

import { useState, useMemo } from "react";
import { Search, X, AlertTriangle } from "lucide-react";
import type { HelpRequest, Topic, Status, Urgency } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { caseDomainColor, caseDomainLabel, cn, urgencyDot, statusColor, formatDateTime } from "@/lib/utils";
import { repeatRecipientNames } from "@/lib/analytics";

type Props = {
  org: OrgId;
  requests: HelpRequest[];
  selectedId: string | null;
  selectedTopic: "All" | Topic;
  onSelectTopic: (topic: "All" | Topic) => void;
  onSelect: (req: HelpRequest) => void;
};

const TOPICS: ("All" | Topic)[] = ["All", "COVID-19", "Dengue", "Haze"];
const STATUSES: ("All" | Status)[] = ["All", "New", "Received", "Accepted", "In Progress", "Unable To Fulfil", "Rerouted"];
const URGENCIES: ("All" | Urgency)[] = ["All", "High", "Medium", "Low"];
const HIDDEN_QUEUE_STATUSES = new Set<Status>(["Fulfilled"]);

function isUnassigned(r: HelpRequest) {
  return r.assignedOrganisation === "Unassigned" || !r.assignedOrganisation;
}

function assignedToLabel(r: HelpRequest, org: OrgId) {
  if (org === "AIC") return r.assignedUnit ?? r.assignedTeam ?? "—";
  return r.assignedTeam ?? r.assignedUnit ?? "Unassigned";
}

export default function RequestQueue({ org, requests, selectedId, selectedTopic, onSelectTopic, onSelect }: Props) {
  const [status, setStatus] = useState<"All" | Status>("All");
  const [urgency, setUrgency] = useState<"All" | Urgency>("All");
  const [search, setSearch] = useState("");

  const visibleRequests = useMemo(
    () => requests.filter((r) => !HIDDEN_QUEUE_STATUSES.has(r.status)),
    [requests]
  );

  const filtered = useMemo(() => {
    return visibleRequests
      .filter((r) => selectedTopic === "All" || r.topic === selectedTopic)
      .filter((r) => status === "All" || r.status === status)
      .filter((r) => urgency === "All" || r.urgency === urgency)
      .filter(
        (r) =>
          !search ||
          r.id.toLowerCase().includes(search.toLowerCase()) ||
          r.helpType.toLowerCase().includes(search.toLowerCase()) ||
          r.area.toLowerCase().includes(search.toLowerCase()) ||
          r.assignedOrganisation.toLowerCase().includes(search.toLowerCase())
      );
  }, [visibleRequests, selectedTopic, status, urgency, search]);

  const repeatNames = useMemo(() => repeatRecipientNames(visibleRequests), [visibleRequests]);

  const hasActiveFilters = selectedTopic !== "All" || status !== "All" || urgency !== "All" || search !== "";

  function clearFilters() {
    onSelectTopic("All");
    setStatus("All");
    setUrgency("All");
    setSearch("");
  }

  const showPartnerCol = org === "AIC";
  const showOutcomeCol = org === "AIC";

  const openCount = visibleRequests.filter((r) => !["Unable To Fulfil", "Rerouted"].includes(r.status)).length;
  const urgentCount = visibleRequests.filter(
    (r) => r.urgency === "High" && !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
  ).length;

  return (
    <div className="ops-card flex h-full w-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-[160px] flex-1">
          <h2 className="text-sm font-semibold text-slate-800">Request Queue</h2>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span>{filtered.length} shown</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-600">{openCount} open</span>
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {urgentCount} urgent
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill label="Topic" value={selectedTopic} onChange={(v) => onSelectTopic(v as typeof selectedTopic)} options={TOPICS} />
          <Pill label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={STATUSES} />
          <Pill label="Urgency" value={urgency} onChange={(v) => setUrgency(v as typeof urgency)} options={URGENCIES} />
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-32 rounded-md border border-slate-200 py-1.5 pl-7 pr-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto thin-scrollbar">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <Th>ID</Th>
              <Th>Topic</Th>
              <Th>Domain</Th>
              <Th>Help Type</Th>
              <Th>Area</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              {showPartnerCol && <Th>Partner Org</Th>}
              <Th>Assigned Unit / Team</Th>
              {showOutcomeCol && <Th>Outcome</Th>}
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-400">No requests match the current filters.</p>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="mt-2 text-xs text-blue-600 hover:underline">
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const unassigned = isUnassigned(req);
                const isRepeat = showOutcomeCol && repeatNames.has(req.recipient.name);
                return (
                  <tr
                    key={req.id}
                    onClick={() => onSelect(req)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedId === req.id
                        ? "bg-blue-50 shadow-[inset_3px_0_0_#2563eb]"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <Td className="font-mono font-medium text-slate-400">
                      <div className="flex items-center gap-1.5">
                        {req.id}
                        {isRepeat && (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-500">
                            Repeat
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-slate-500">{req.topic}</Td>
                    <Td>
                      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold", caseDomainColor(req.caseDomain))}>
                        {req.caseDomain}
                        <span className="hidden font-medium xl:inline">{caseDomainLabel(req.caseDomain)}</span>
                      </span>
                    </Td>
                    <Td className="font-medium text-slate-700">{req.helpType}</Td>
                    <Td className="text-slate-500">{req.area}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-600">
                        <span className={cn("h-1.5 w-1.5 rounded-full", urgencyDot(req.urgency))} />
                        {req.urgency}
                      </span>
                    </Td>
                    <Td>
                      <span className={cn("inline-flex min-w-[72px] justify-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium", statusColor(req.status))}>
                        {req.status}
                      </span>
                    </Td>
                    {showPartnerCol && (
                      <Td>
                        {unassigned ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle size={10} /> Unassigned
                          </span>
                        ) : (
                          <span className="text-slate-600">{req.assignedOrganisation}</span>
                        )}
                      </Td>
                    )}
                    <Td className="text-slate-500">{assignedToLabel(req, org)}</Td>
                    {showOutcomeCol && (
                      <Td className="text-slate-500 max-w-[220px]">
                        {req.outcome ? (
                          <span className="line-clamp-2">{req.outcome}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                    )}
                    <Td className="text-slate-400 whitespace-nowrap">{formatDateTime(req.submittedAt)}</Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-semibold">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("h-12 px-4 align-middle", className)}>{children}</td>;
}

function Pill<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "rounded-md border bg-white px-2 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        value === "All"
          ? "border-slate-200 text-slate-500"
          : "border-slate-300 font-medium text-slate-800"
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o === "All" ? `${label}: All` : o}</option>
      ))}
    </select>
  );
}

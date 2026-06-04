"use client";

import { useState, useMemo } from "react";
import { Search, X, AlertTriangle } from "lucide-react";
import type { HelpRequest, Topic, Status, Urgency } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { cn, urgencyColor, statusColor, formatDateTime } from "@/lib/utils";
import { repeatRecipientNames } from "@/lib/analytics";

type Props = {
  org: OrgId;
  requests: HelpRequest[];
  selectedId: string | null;
  selectedTopic: "All" | Topic;
  onSelectTopic: (topic: "All" | Topic) => void;
  onSelect: (req: HelpRequest) => void;
};

const TOPICS: ("All" | Topic)[] = ["All", "COVID-19", "Dengue"];
const STATUSES: ("All" | Status)[] = ["All", "New", "Received", "Accepted", "In Progress", "Unable To Fulfil", "Rerouted"];
const URGENCIES: ("All" | Urgency)[] = ["All", "High", "Medium", "Low"];
const HIDDEN_QUEUE_STATUSES = new Set<Status>(["Fulfilled"]);

function isUnassigned(r: HelpRequest) {
  return r.assignedOrganisation === "Unassigned" || !r.assignedOrganisation;
}

function assignedToLabel(r: HelpRequest, org: OrgId) {
  if (org === "Pharmacy") return r.pharmacyBranch ?? "Unrouted";
  if (org === "AIC") return r.assignedTeam ?? r.pharmacyBranch ?? "—";
  return r.assignedTeam ?? r.assignedCentre ?? "Unassigned";
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
  const showFlagCol = org === "Pharmacy";

  const openCount = visibleRequests.filter((r) => !["Unable To Fulfil", "Rerouted"].includes(r.status)).length;
  const urgentCount = visibleRequests.filter(
    (r) => r.urgency === "High" && !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
  ).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-full w-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex-1 min-w-[160px]">
          <h2 className="font-semibold text-slate-800 text-sm">Request Queue</h2>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>{filtered.length} shown</span>
            <span className="text-slate-300">·</span>
            <span className="text-blue-600 font-medium">{openCount} open</span>
            <span className="text-red-600 font-medium">{urgentCount} urgent</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wide">
              <Th>ID</Th>
              {showFlagCol && <Th>Flag</Th>}
              <Th>Topic</Th>
              <Th>Help Type</Th>
              <Th>Area</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              {showPartnerCol && <Th>Partner Org</Th>}
              <Th>Assigned To</Th>
              {showOutcomeCol && <Th>Outcome</Th>}
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
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
                const hiRisk = req.medications?.some((m) => m.highRisk) ?? false;
                const isRepeat = showOutcomeCol && repeatNames.has(req.recipient.name);
                return (
                  <tr
                    key={req.id}
                    onClick={() => onSelect(req)}
                    className={cn(
                      "cursor-pointer hover:bg-blue-50 transition-colors",
                      selectedId === req.id && "bg-blue-50 ring-2 ring-inset ring-blue-400",
                      isRepeat && selectedId !== req.id && "bg-purple-50/60"
                    )}
                  >
                    <Td className="font-mono text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        {req.id}
                        {isRepeat && (
                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-100 text-purple-700">
                            Repeat
                          </span>
                        )}
                      </div>
                    </Td>
                    {showFlagCol && (
                      <Td>
                        {hiRisk ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            <AlertTriangle size={10} /> High-risk
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                    )}
                    <Td className="text-slate-500">{req.topic}</Td>
                    <Td className="text-slate-700 font-medium">{req.helpType}</Td>
                    <Td className="text-slate-500">{req.area}</Td>
                    <Td>
                      <span className={cn("font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", urgencyColor(req.urgency))}>
                        {req.urgency}
                      </span>
                    </Td>
                    <Td>
                      <span className={cn("font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", statusColor(req.status))}>
                        {req.status}
                      </span>
                    </Td>
                    {showPartnerCol && (
                      <Td>
                        {unassigned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
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
  return <th className="text-left font-medium px-4 py-2">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
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
        "text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white transition-colors",
        value === "All" ? "border-slate-200 text-slate-500" : "border-blue-300 text-blue-700 bg-blue-50"
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o === "All" ? `${label}: All` : o}</option>
      ))}
    </select>
  );
}

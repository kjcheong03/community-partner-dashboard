"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import type { HelpRequest, Topic, Status, Urgency, HelpType } from "@/lib/types";
import { cn, urgencyColor, statusColor, formatDateTime } from "@/lib/utils";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
  selectedId: string | null;
  onSelect: (req: HelpRequest) => void;
};

const AREAS = ["All Areas", "Tampines", "Bedok", "Jurong West", "Woodlands", "Ang Mo Kio", "Clementi", "Sengkang", "Queenstown", "Punggol", "Pasir Ris", "Yishun", "Hougang", "Jurong East", "Bukit Merah", "Geylang", "Kallang", "Serangoon", "Toa Payoh"];
const HELP_TYPES: ("All Types" | HelpType)[] = ["All Types", "Medication Collection", "Transport Support", "Welfare Check", "Food & Essentials", "Masks & Hygiene", "Advisory Assistance"];
const STATUSES: ("All Statuses" | Status)[] = ["All Statuses", "New", "Received", "Accepted", "In Progress", "Fulfilled", "Unable To Fulfil", "Rerouted"];
const URGENCIES: ("All" | Urgency)[] = ["All", "High", "Medium", "Low"];

export default function RequestQueue({ requests, topic, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("All Areas");
  const [helpType, setHelpType] = useState<"All Types" | HelpType>("All Types");
  const [status, setStatus] = useState<"All Statuses" | Status>("All Statuses");
  const [urgency, setUrgency] = useState<"All" | Urgency>("All");

  const filtered = useMemo(() => {
    return requests
      .filter((r) => r.topic === topic)
      .filter((r) => area === "All Areas" || r.area === area)
      .filter((r) => helpType === "All Types" || r.helpType === helpType)
      .filter((r) => status === "All Statuses" || r.status === status)
      .filter((r) => urgency === "All" || r.urgency === urgency)
      .filter(
        (r) =>
          !search ||
          r.id.toLowerCase().includes(search.toLowerCase()) ||
          r.area.toLowerCase().includes(search.toLowerCase()) ||
          r.helpType.toLowerCase().includes(search.toLowerCase()) ||
          r.assignedOrganisation.toLowerCase().includes(search.toLowerCase())
      );
  }, [requests, topic, area, helpType, status, urgency, search]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
      {/* Queue header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-slate-800">Active Request Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} requests</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-slate-400" />
          <Select value={area} onChange={setArea} options={AREAS} />
          <Select value={helpType} onChange={(v) => setHelpType(v as typeof helpType)} options={HELP_TYPES} />
          <Select value={status} onChange={(v) => setStatus(v as typeof status)} options={STATUSES} />
          <Select value={urgency} onChange={(v) => setUrgency(v as typeof urgency)} options={URGENCIES} />
        </div>
      </div>

      {/* Table — overflow-x-auto prevents horizontal bleed when drawer is open */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[80px_100px_1fr_90px_140px_1fr_110px] gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide min-w-[640px]">
          <span>ID</span>
          <span>Area</span>
          <span>Help Type</span>
          <span>Urgency</span>
          <span>Status</span>
          <span>Assigned To</span>
          <span>Submitted</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50 min-w-[640px]">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">
              No requests match the selected filters.
            </div>
          ) : (
            filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => onSelect(req)}
                className={cn(
                  "w-full grid grid-cols-[80px_100px_1fr_90px_140px_1fr_110px] gap-3 px-5 py-3.5 text-left text-sm hover:bg-blue-50 transition-colors",
                  selectedId === req.id && "bg-blue-50 border-l-2 border-l-blue-500"
                )}
              >
                <span className="font-mono text-xs text-slate-500 font-medium">{req.id}</span>
                <span className="text-slate-700 font-medium truncate">{req.area}</span>
                <span className="text-slate-600 truncate">{req.helpType}</span>
                <span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", urgencyColor(req.urgency))}>
                    {req.urgency}
                  </span>
                </span>
                <span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", statusColor(req.status))}>
                    {req.status}
                  </span>
                </span>
                <span className="text-slate-500 text-xs truncate">{req.assignedOrganisation}</span>
                <span className="text-slate-400 text-xs whitespace-nowrap">{formatDateTime(req.submittedAt)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

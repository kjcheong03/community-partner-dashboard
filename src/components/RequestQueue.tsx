"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { HelpRequest, Topic, Status, Urgency } from "@/lib/types";
import { cn, urgencyColor, statusColor, formatDateTime } from "@/lib/utils";

type Props = {
  requests: HelpRequest[];
  selectedArea: string | null;
  selectedId: string | null;
  selectedTopic: "All" | Topic;
  onSelectTopic: (topic: "All" | Topic) => void;
  onSelect: (req: HelpRequest) => void;
};

const TOPICS: ("All" | Topic)[] = ["All", "COVID-19", "Dengue", "Haze"];
const STATUSES: ("All" | Status)[] = ["All", "New", "Received", "Accepted", "In Progress", "Fulfilled", "Unable To Fulfil", "Rerouted"];
const URGENCIES: ("All" | Urgency)[] = ["All", "High", "Medium", "Low"];

export default function RequestQueue({ requests, selectedArea, selectedId, selectedTopic, onSelectTopic, onSelect }: Props) {
  const [status, setStatus] = useState<"All" | Status>("All");
  const [urgency, setUrgency] = useState<"All" | Urgency>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return requests
      .filter((r) => selectedTopic === "All" || r.topic === selectedTopic)
      .filter((r) => !selectedArea || r.area === selectedArea)
      .filter((r) => status === "All" || r.status === status)
      .filter((r) => urgency === "All" || r.urgency === urgency)
      .filter(
        (r) =>
          !search ||
          r.id.toLowerCase().includes(search.toLowerCase()) ||
          r.helpType.toLowerCase().includes(search.toLowerCase()) ||
          r.assignedOrganisation.toLowerCase().includes(search.toLowerCase())
      );
  }, [requests, selectedTopic, selectedArea, status, urgency, search]);

  const hasActiveFilters = selectedTopic !== "All" || status !== "All" || urgency !== "All" || search !== "";

  function clearFilters() {
    onSelectTopic("All");
    setStatus("All");
    setUrgency("All");
    setSearch("");
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-800 text-sm">
            Request Queue
            {selectedArea && <span className="ml-2 text-xs font-normal text-slate-400">— {selectedArea}</span>}
          </h2>
          <p className="text-xs text-slate-400">{filtered.length} requests</p>
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

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[72px_80px_1fr_90px_140px_1fr_100px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide min-w-[620px]">
          <span>ID</span>
          <span>Topic</span>
          <span>Help Type</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Assigned To</span>
          <span>Submitted</span>
        </div>

        <div className="divide-y divide-slate-50 min-w-[620px]">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-400">No requests match the current filters.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-xs text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => onSelect(req)}
                className={cn(
                  "w-full grid grid-cols-[72px_80px_1fr_90px_140px_1fr_100px] gap-2 px-4 py-3 text-left text-xs hover:bg-blue-50 transition-colors",
                  selectedId === req.id && "bg-blue-50 ring-2 ring-inset ring-blue-400"
                )}
              >
                <span className="font-mono text-slate-400 font-medium">{req.id}</span>
                <span className="text-slate-500 truncate">{req.topic}</span>
                <span className="text-slate-700 font-medium truncate">{req.helpType}</span>
                <span>
                  <span className={cn("font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", urgencyColor(req.urgency))}>
                    {req.urgency}
                  </span>
                </span>
                <span>
                  <span className={cn("font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", statusColor(req.status))}>
                    {req.status}
                  </span>
                </span>
                <span className="text-slate-500 truncate">{req.assignedOrganisation}</span>
                <span className="text-slate-400 whitespace-nowrap">{formatDateTime(req.submittedAt)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
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

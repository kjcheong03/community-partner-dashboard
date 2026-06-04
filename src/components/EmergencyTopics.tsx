"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Megaphone, Siren, Users, X } from "lucide-react";
import type { HelpRequest, EmergencyTopic, Topic } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { cn, urgencyColor } from "@/lib/utils";
import { repeatRecipientNames } from "@/lib/analytics";

type Props = {
  org: OrgId;
  requests: HelpRequest[];
  topics: EmergencyTopic[];
  selectedTopic: "All" | Topic;
  onSelectTopic: (topic: "All" | Topic) => void;
};

const URGENCY_DOT: Record<string, string> = {
  High: "bg-red-500",
  Medium: "bg-amber-500",
  Low: "bg-green-500",
};

function breakdown(requests: HelpRequest[], key: (r: HelpRequest) => string) {
  const m = new Map<string, number>();
  for (const r of requests) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default function EmergencyTopics({ org, requests, topics, selectedTopic, onSelectTopic }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const summaries = useMemo(
    () =>
      topics.map((topic) => {
        const linked = requests.filter((r) => r.topic === topic.topic);
        return {
          topic,
          linked,
          typeBreakdown: breakdown(linked, (r) => r.helpType),
          affectedAreas: breakdown(linked, (r) => r.area),
        };
      }),
    [requests, topics]
  );
  const selectedSummary = summaries.find(({ topic }) => topic.topic === selectedTopic);
  const visibleSummaries = selectedSummary ? [selectedSummary] : summaries;
  const linkedTotal = summaries.reduce((sum, s) => sum + s.linked.length, 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 bg-white text-red-500 shrink-0">
            <Siren size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">Active Emergency Topics</h2>
            <p className="text-xs text-slate-400">
              {topics.length} active · {linkedTotal} linked case{linkedTotal === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <select
          value={selectedTopic}
          onChange={(e) => onSelectTopic(e.target.value as "All" | Topic)}
          className={cn(
            "h-8 min-w-[190px] rounded-md border px-2 text-xs font-medium bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400",
            selectedTopic === "All" ? "border-slate-200 text-slate-500" : "border-blue-300 text-blue-700 bg-blue-50"
          )}
        >
          <option value="All">All emergency topics</option>
          {summaries.map(({ topic, linked }) => (
            <option key={topic.id} value={topic.topic}>
              {topic.topic} ({linked.length})
            </option>
          ))}
        </select>

        {selectedSummary && (
          <button
            onClick={() => onSelectTopic("All")}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={12} /> Clear
          </button>
        )}

        <button
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          aria-expanded={showDetails}
        >
          Details {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {showDetails && (
        <div className="mt-2 border-t border-slate-100 pt-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
          {visibleSummaries.map(({ topic, linked, typeBreakdown, affectedAreas }) => (
            <TopicDetail
              key={topic.id}
              org={org}
              topic={topic}
              linked={linked}
              typeBreakdown={typeBreakdown}
              affectedAreas={affectedAreas}
              selected={selectedTopic === topic.topic}
              onSelect={() => onSelectTopic(selectedTopic === topic.topic ? "All" : topic.topic)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicDetail({
  org,
  topic,
  linked,
  typeBreakdown,
  affectedAreas,
  selected,
  onSelect,
}: {
  org: OrgId;
  topic: EmergencyTopic;
  linked: HelpRequest[];
  typeBreakdown: [string, number][];
  affectedAreas: [string, number][];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-lg border px-3 py-2 transition-colors",
        selected ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", URGENCY_DOT[topic.urgency])} />
            <h3 className="text-sm font-semibold text-slate-800 truncate">{topic.name}</h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{topic.advisorySummary}</p>
        </div>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", urgencyColor(topic.urgency))}>
          {topic.urgency}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-700">{linked.length}</span>
        <span className="text-slate-400">linked case{linked.length === 1 ? "" : "s"}</span>
        {affectedAreas.slice(0, 3).map(([area, n]) => (
          <span key={area} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {area} · {n}
          </span>
        ))}
      </div>

      {typeBreakdown.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {typeBreakdown.slice(0, 4).map(([type, n]) => (
            <span key={type} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {type} · {n}
            </span>
          ))}
        </div>
      )}

      <OrgFooter org={org} topic={topic} linked={linked} />
    </button>
  );
}

function OrgFooter({ org, topic, linked }: { org: OrgId; topic: EmergencyTopic; linked: HelpRequest[] }) {
  if (org === "AIC") {
    const repeats = repeatRecipientNames(linked).size;
    const watchList = linked.filter((r) => r.flaggedForCareReview).length;
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1 text-slate-600">
          <Users size={12} className="text-amber-500" /> {repeats} repeat household{repeats === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1 text-slate-600">
          <AlertTriangle size={12} className="text-purple-500" /> {watchList} on care-review watch list
        </span>
      </div>
    );
  }

  const note = topic.orgNotes[org];
  const noteTone =
    org === "SGCares"
      ? "text-blue-700 bg-blue-50/60"
      : org === "AACSGO"
        ? "text-purple-700 bg-purple-50/60"
        : org === "SSOFSC"
          ? "text-green-700 bg-green-50/60"
          : "text-teal-700 bg-teal-50/60";
  const iconTone =
    org === "SGCares"
      ? "text-blue-500"
      : org === "AACSGO"
        ? "text-purple-500"
        : org === "SSOFSC"
          ? "text-green-500"
          : "text-teal-500";

  return (
    <div className={cn("mt-3 pt-3 border-t border-slate-100 flex items-start gap-1.5 text-xs -mx-1 px-2 py-1.5 rounded-lg", noteTone)}>
      <Megaphone size={13} className={cn("mt-0.5 shrink-0", iconTone)} />
      <span className="leading-relaxed">{note}</span>
    </div>
  );
}

"use client";

import type { HelpRequest, Topic } from "@/lib/types";

type Props = {
  requests: HelpRequest[];
  topic: Topic;
};

export default function KpiRow({ requests, topic }: Props) {
  const filtered = requests.filter((r) => r.topic === topic);

  const open = filtered.filter(
    (r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)
  ).length;
  const highPriority = filtered.filter((r) => r.urgency === "High").length;
  const inProgress = filtered.filter((r) => r.status === "In Progress").length;
  const fulfilledToday = filtered.filter((r) => r.status === "Fulfilled").length;
  const unableToFulfil = filtered.filter((r) => r.status === "Unable To Fulfil").length;

  const stats = [
    { label: "Open", value: open, color: "text-blue-600", dot: "bg-blue-500" },
    { label: "High Priority", value: highPriority, color: "text-red-600", dot: "bg-red-500" },
    { label: "In Progress", value: inProgress, color: "text-amber-600", dot: "bg-amber-500" },
    { label: "Fulfilled Today", value: fulfilledToday, color: "text-slate-600", dot: "bg-slate-400" },
    { label: "Unable To Fulfil", value: unableToFulfil, color: "text-slate-500", dot: "bg-slate-300" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-6">
      {stats.map(({ label, value, color, dot }, i) => (
        <div key={label} className={`flex items-center gap-3 ${i > 0 ? "pl-6 border-l border-slate-100" : ""}`}>
          <div className={`w-2 h-2 rounded-full ${dot}`} />
          <div>
            <p className="text-xs text-slate-400 leading-none mb-0.5">{label}</p>
            <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

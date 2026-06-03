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
  const fulfilledToday = filtered.filter((r) => r.status === "Fulfilled").length;
  const unableToFulfil = filtered.filter((r) => r.status === "Unable To Fulfil").length;

  const stats = [
    {
      label: "Open Requests",
      value: open,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "High Priority",
      value: highPriority,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    },
    {
      label: "Fulfilled Today",
      value: fulfilledToday,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100",
    },
    {
      label: "Unable To Fulfil",
      value: unableToFulfil,
      color: "text-slate-600",
      bg: "bg-slate-50",
      border: "border-slate-200",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map(({ label, value, color, bg, border }) => (
        <div
          key={label}
          className={`${bg} ${border} border rounded-xl px-5 py-4`}
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

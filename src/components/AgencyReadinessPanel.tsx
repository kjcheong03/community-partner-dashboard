"use client";

import { useMemo, useState } from "react";
import { Package, Truck, CheckCircle2 } from "lucide-react";
import type { OrgId } from "@/lib/orgs";
import { getOrg } from "@/lib/orgs";
import { readinessItems, readinessUnits, type ReadinessItem } from "@/data/agencyReadiness";
import { cn } from "@/lib/utils";

type Props = {
  org: OrgId;
};

export default function AgencyReadinessPanel({ org }: Props) {
  const [queuedOrders, setQueuedOrders] = useState<Set<string>>(new Set());
  const units = readinessUnits[org];
  const orgConfig = getOrg(org);
  const available = units.reduce((sum, unit) => sum + unit.available, 0);
  const capacity = units.reduce((sum, unit) => sum + unit.capacity, 0);
  const items = readinessItems[org];
  const watchItems = items.filter((item) => item.status !== "OK");

  const title = useMemo(() => {
    if (org === "AIC") return "National Readiness";
    if (org === "SGCares") return "Volunteer Management";
    if (org === "SSOFSC") return "Casework Team Capacity";
    if (org === "AACSGO") return "AAC/SGO Outreach Capacity";
    return "Care Services Capacity";
  }, [org]);

  function queueOrder(id: string) {
    setQueuedOrders((prev) => new Set(prev).add(id));
  }

  function statusClass(status: ReadinessItem["status"]) {
    if (status === "OK") return "bg-emerald-500";
    if (status === "Low") return "bg-amber-500";
    return "bg-amber-500";
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate">{title}</h2>
          <p className="text-xs text-slate-400">
            {available}/{capacity} slots available · {orgConfig.shortName}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Package size={13} className={watchItems.length > 0 ? "text-amber-500" : "text-emerald-500"} />
          <span className="font-medium text-slate-600">
            {watchItems.length} {org === "AIC" ? "reorder watch" : "capacity watch"}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-2">
        {units.map((unit) => {
          const pct = unit.capacity === 0 ? 0 : (unit.available / unit.capacity) * 100;
          return (
            <div key={unit.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{unit.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{unit.focus}</p>
                </div>
                <span className={cn("text-xs font-bold", pct <= 35 ? "text-red-600" : pct <= 60 ? "text-amber-600" : "text-green-600")}>
                  {unit.available}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", pct <= 35 ? "bg-red-500" : pct <= 60 ? "bg-amber-500" : "bg-green-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {items.map((item) => {
          const queued = queuedOrders.has(item.id);
          return (
            <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.quantity} {item.unit}</p>
                </div>
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white", statusClass(item.status))}>
                  {item.status}
                </span>
              </div>
              {item.actionLabel && (
                <button
                  onClick={() => queueOrder(item.id)}
                  className={cn(
                    "mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                    queued
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-amber-500 text-white hover:bg-amber-600"
                  )}
                >
                  {queued ? <CheckCircle2 size={11} /> : <Truck size={11} />}
                  {queued ? item.queuedLabel ?? "Queued" : item.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

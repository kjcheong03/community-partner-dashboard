"use client";

import { ChevronDown, Building2 } from "lucide-react";
import { ORGS, getOrg, type OrgId } from "@/lib/orgs";

type Props = {
  org: OrgId;
  onChangeOrg: (org: OrgId) => void;
};

export default function TopNav({ org, onChangeOrg }: Props) {
  const current = getOrg(org);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-slate-800">Community Dashboard</h1>
        <span className="hidden text-xs text-slate-400 md:block">{current.context}</span>
      </div>

      <div className="relative shrink-0">
        <Building2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <select
          value={org}
          onChange={(e) => onChangeOrg(e.target.value as OrgId)}
          className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ORGS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </header>
  );
}

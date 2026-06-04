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
    <header className="bg-slate-900 px-6 flex items-center justify-between h-14 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
          C
        </div>
        <span className="text-white font-semibold text-sm">CARA</span>
        <span className="text-slate-600 text-sm">|</span>
        <span className="text-slate-300 text-sm hidden sm:block">Community Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-slate-500 text-xs hidden lg:block">{current.context}</span>

        <div className="relative">
          <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={org}
            onChange={(e) => onChangeOrg(e.target.value as OrgId)}
            className="appearance-none bg-slate-800 text-white text-sm font-medium border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-700 transition-colors"
          >
            {ORGS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </header>
  );
}

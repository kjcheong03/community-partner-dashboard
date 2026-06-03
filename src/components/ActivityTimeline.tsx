"use client";

import type { ActivityLogEntry } from "@/lib/types";
import { formatTime } from "@/lib/utils";

type Props = {
  entries: ActivityLogEntry[];
};

export default function ActivityTimeline({ entries }: Props) {
  return (
    <div className="space-y-3">
      {[...entries].reverse().map((entry, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0" />
            {i < entries.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
          </div>
          <div className="pb-3">
            <p className="text-sm text-slate-700">{entry.action}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatTime(entry.timestamp)}
              {entry.actor && ` · ${entry.actor}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

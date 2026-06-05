"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/contract";

type Props = {
  /** Allowed next states (from the contract's TRANSITIONS, via WorkItem.transitions). */
  transitions: RequestStatus[];
  onChange: (next: RequestStatus, reason?: string) => void;
  className?: string;
};

// Positive transitions get a filled button; Reject/Cancel are quieter outlines.
function toneFor(next: RequestStatus): string {
  if (next === "Rejected") return "border border-red-200 text-red-700 hover:bg-red-50";
  if (next === "Cancelled") return "border border-slate-200 text-slate-600 hover:bg-slate-50";
  return "bg-slate-900 text-white hover:bg-slate-800";
}

export default function StatusActionBar({ transitions, onChange, className }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const terminal = transitions.length === 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {terminal ? (
        <p className="text-xs text-slate-400">No further actions — this item is closed.</p>
      ) : rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={2}
            className="w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => {
                onChange("Rejected", reason.trim());
                setRejecting(false);
                setReason("");
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => (next === "Rejected" ? setRejecting(true) : onChange(next))}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", toneFor(next))}
            >
              {next === "Accepted" && "Accept"}
              {next === "Rejected" && "Reject"}
              {next === "In progress" && "Start"}
              {next === "Completed" && "Complete"}
              {next === "Cancelled" && "Cancel"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

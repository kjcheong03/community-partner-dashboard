import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CaseDomain, Status, Urgency } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Restrained state palette — only High/urgent reads loud; everything else is quiet.
export function urgencyColor(urgency: Urgency): string {
  return {
    High: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    Medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    Low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  }[urgency];
}

// Small coloured dot used alongside neutral status/urgency text.
export function urgencyDot(urgency: Urgency): string {
  return { High: "bg-red-500", Medium: "bg-amber-500", Low: "bg-slate-400" }[urgency];
}

// Status as a soft tinted pill rather than a solid block — keeps rows calm.
export function statusColor(status: Status): string {
  const map: Record<Status, string> = {
    New: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    Received: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    Accepted: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    "In Progress": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    Fulfilled: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    "Unable To Fulfil": "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    Rerouted: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  };
  return map[status];
}

export function statusDot(status: Status): string {
  const map: Record<Status, string> = {
    New: "bg-blue-500",
    Received: "bg-blue-500",
    Accepted: "bg-emerald-500",
    "In Progress": "bg-amber-500",
    Fulfilled: "bg-emerald-500",
    "Unable To Fulfil": "bg-red-500",
    Rerouted: "bg-slate-400",
  };
  return map[status];
}

export function caseDomainLabel(domain: CaseDomain): string {
  return {
    A: "Psycho-social constraints",
    B: "Medical complexities",
    C: "Functional impairment",
  }[domain];
}

// Domain is a classification, not a state — render it neutrally so it doesn't
// compete with urgency/status for attention.
export function caseDomainColor(_domain: CaseDomain): string {
  void _domain;
  return "bg-slate-100 text-slate-600 border-slate-200";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateParts(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return {
      day: Number(match[3]),
      month: Number(match[2]) - 1,
      hour: Number(match[4]),
      minute: Number(match[5]),
    };
  }

  const date = new Date(iso);
  return {
    day: date.getDate(),
    month: date.getMonth(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function formatClock(hour24: number, minute: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatTime(iso: string): string {
  const parts = dateParts(iso);
  return formatClock(parts.hour, parts.minute);
}

export function formatDateTime(iso: string): string {
  const parts = dateParts(iso);
  return `${String(parts.day).padStart(2, "0")} ${MONTHS[parts.month] ?? ""} at ${formatClock(parts.hour, parts.minute)}`;
}

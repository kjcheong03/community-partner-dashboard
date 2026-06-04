import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CaseDomain, Status, Urgency } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function urgencyColor(urgency: Urgency): string {
  return {
    High: "bg-red-100 text-red-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-green-100 text-green-700",
  }[urgency];
}

export function statusColor(status: Status): string {
  const map: Record<Status, string> = {
    New: "bg-blue-600 text-white",
    Received: "bg-sky-600 text-white",
    Accepted: "bg-emerald-600 text-white",
    "In Progress": "bg-orange-500 text-white",
    Fulfilled: "bg-emerald-600 text-white",
    "Unable To Fulfil": "bg-red-600 text-white",
    Rerouted: "bg-slate-600 text-white",
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

export function caseDomainColor(domain: CaseDomain): string {
  return {
    A: "bg-purple-50 text-purple-700 border-purple-100",
    B: "bg-rose-50 text-rose-700 border-rose-100",
    C: "bg-cyan-50 text-cyan-700 border-cyan-100",
  }[domain];
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

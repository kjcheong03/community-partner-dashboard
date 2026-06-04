import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Status, Urgency } from "./types";

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
    New: "bg-blue-100 text-blue-700",
    Received: "bg-indigo-100 text-indigo-700",
    Accepted: "bg-violet-100 text-violet-700",
    "In Progress": "bg-amber-100 text-amber-700",
    Fulfilled: "bg-green-100 text-green-700",
    "Unable To Fulfil": "bg-red-100 text-red-700",
    Rerouted: "bg-slate-100 text-slate-600",
  };
  return map[status];
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

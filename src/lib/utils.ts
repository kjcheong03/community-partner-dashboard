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

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

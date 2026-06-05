"use client";

import { useMemo, useState } from "react";
import { Boxes, ChevronLeft, ChevronRight, Compass, HeartPulse, Home, PhoneCall, Soup, Truck, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScheduleItem = {
  id: string;
  title: string;
  when: string /* ISO */;
  meta?: string;
  assignee?: string;
  status?: string;
  scheduleStatus?: "Scheduled" | "In progress" | "Completed";
  visitMode?: "home" | "video" | "phone";
  priority?: "High" | "Medium" | "Low";
  kind?: "supplies" | "food" | "welfare" | "transport" | "referral";
};

type Placed = ScheduleItem & {
  dateKey: string;
  hour: number;
  minute: number;
  ms: number;
};

const START_HOUR = 9;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SLOT_HEIGHT = 46;
const DAY_MS = 86_400_000;

const KIND_ICON: Record<NonNullable<ScheduleItem["kind"]>, LucideIcon> = {
  supplies: Boxes,
  food: Soup,
  welfare: HeartPulse,
  transport: Truck,
  referral: Compass,
};

const VISIT_ICON: Record<NonNullable<ScheduleItem["visitMode"]>, LucideIcon> = {
  home: Home,
  video: Video,
  phone: PhoneCall,
};

function sgtParts(ms: number) {
  const d = new Date(ms + 8 * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay() };
}

function sgtDayStart(y: number, m: number, day: number) {
  return Date.UTC(y, m, day) - 8 * 3_600_000;
}

function weekStart(anchorMs: number) {
  const p = sgtParts(anchorMs);
  const sinceMon = (p.dow + 6) % 7;
  return sgtDayStart(p.y, p.m, p.day - sinceMon);
}

function dateKey(ms: number) {
  const p = sgtParts(ms);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function hourOf(ms: number) {
  return new Date(ms + 8 * 3_600_000).getUTCHours();
}

function minuteOf(ms: number) {
  return new Date(ms + 8 * 3_600_000).getUTCMinutes();
}

function normalizePlaced(it: ScheduleItem): Placed {
  const ms = new Date(it.when).getTime();
  return { ...it, dateKey: dateKey(ms), hour: hourOf(ms), minute: minuteOf(ms), ms };
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

function shortDay(ms: number) {
  return new Date(ms).toLocaleDateString("en-SG", { weekday: "short" });
}

function hhmm(h: number, m = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function blockOffset(it: Placed) {
  return Math.max(0, ((it.hour - START_HOUR) * 60 + it.minute) / 60) * SLOT_HEIGHT;
}

function blockSlotKey(it: Placed) {
  return `${it.dateKey}:${it.hour}:${Math.floor(it.minute / 30)}`;
}

function scheduleTone(item: ScheduleItem) {
  if (item.kind === "transport") return "border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100";
  if (item.visitMode === "home") return "border-red-200 bg-red-50 text-red-900 hover:bg-red-100";
  if (item.visitMode === "video" || item.visitMode === "phone") return "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100";
  return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
}

function titleParts(title: string) {
  const [type, recipient] = title.split(" · ");
  return { type: type ?? title, recipient: recipient ?? "" };
}

export default function ScheduleBoard({
  items,
  onSelect,
  className,
}: {
  items: ScheduleItem[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const [mode, setMode] = useState<"time" | "assignee">("time");
  const [weekOffset, setWeekOffset] = useState(0);
  const [todayKey] = useState(() => dateKey(Date.now()));
  const placed = useMemo(() => items.map(normalizePlaced).sort((a, b) => a.ms - b.ms), [items]);
  const anchorMs = placed[0]?.ms ?? Date.UTC(2026, 5, 5);
  const start = weekStart(anchorMs) + weekOffset * 7 * DAY_MS;
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => start + i * DAY_MS), [start]);
  const weekKeys = useMemo(() => new Set(week.map(dateKey)), [week]);
  const rows = placed.filter((it) => weekKeys.has(it.dateKey) && it.hour >= START_HOUR && it.hour < END_HOUR);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(["time", "assignee"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === m ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {m === "time" ? "By time" : "By assignee"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value - 1)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-40 text-center text-xs font-medium text-slate-400">{dayLabel(week[0])} - {dayLabel(week[6])}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value + 1)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {mode === "time" ? (
        <WeekGrid rows={rows} week={week} todayKey={todayKey} onSelect={onSelect} />
      ) : (
        <AssigneeGrid rows={rows} onSelect={onSelect} />
      )}
    </div>
  );
}

function WeekGrid({ rows, week, todayKey, onSelect }: { rows: Placed[]; week: number[]; todayKey: string; onSelect?: (id: string) => void }) {
  const byDay = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const r of rows) m.set(r.dateKey, [...(m.get(r.dateKey) ?? []), r]);
    return m;
  }, [rows]);

  return (
    <div className="overflow-x-auto thin-scrollbar rounded-lg border border-slate-200">
      <div className="grid min-w-[980px]" style={{ gridTemplateColumns: "64px repeat(7, minmax(128px, 1fr))" }}>
        <div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50" />
        {week.map((ms) => {
          const key = dateKey(ms);
          const today = key === todayKey;
          return (
            <div
              key={key}
              className={cn(
                "border-b border-r border-slate-200 px-2 py-2 text-center",
                today ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-500"
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider">{shortDay(ms)}</div>
            </div>
          );
        })}

        <TimeAxis />
        {week.map((ms) => {
          const key = dateKey(ms);
          return (
            <DayColumn key={key} rows={byDay.get(key) ?? []} today={key === todayKey} onSelect={onSelect} />
          );
        })}
      </div>
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="sticky left-0 z-10 border-r border-slate-200 bg-white">
      {HOURS.map((h) => (
        <div key={h} className="h-[46px] border-b border-slate-100 pr-2 pt-1 text-right text-[11px] font-medium tabular-nums text-slate-400">
          {hhmm(h)}
        </div>
      ))}
    </div>
  );
}

function DayColumn({ rows, today, onSelect }: { rows: Placed[]; today?: boolean; onSelect?: (id: string) => void }) {
  const visibleRows = rows.filter((r) => r.hour >= START_HOUR && r.hour < END_HOUR);
  const groups = new Map<string, Placed[]>();
  for (const r of visibleRows) groups.set(blockSlotKey(r), [...(groups.get(blockSlotKey(r)) ?? []), r]);

  return (
    <div className={cn("relative border-r border-slate-200", today && "bg-blue-50/30")} style={{ height: HOURS.length * SLOT_HEIGHT }}>
      {HOURS.map((h) => (
        <div key={h} className="h-[46px] border-b border-slate-100" />
      ))}
      {[...groups.values()].map((group) => (
        <StackedBlocks key={blockSlotKey(group[0])} group={group} onSelect={onSelect} />
      ))}
    </div>
  );
}

function StackedBlocks({ group, onSelect }: { group: Placed[]; onSelect?: (id: string) => void }) {
  const shown = group.slice(0, 2);
  const hidden = group.length - shown.length;
  return (
    <div className="absolute left-1 right-1 flex flex-col gap-1" style={{ top: blockOffset(group[0]) + 4 }}>
      {shown.map((it) => (
        <ScheduleBlock key={it.id} item={it} onSelect={onSelect} compact />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => onSelect?.(group[2].id)}
          className="rounded border border-slate-200 bg-white px-1.5 py-1 text-left text-[10px] font-semibold text-slate-500 shadow-sm hover:bg-slate-50"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}

function AssigneeGrid({ rows, onSelect }: { rows: Placed[]; onSelect?: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const r of rows) {
      const key = r.assignee?.trim() || "Unassigned";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])));
  }, [rows]);

  return (
    <div className="overflow-x-auto thin-scrollbar rounded-lg border border-slate-200">
      <div className="grid min-w-[860px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, groups.length)}, minmax(180px, 1fr))` }}>
        {groups.map(([assignee, list]) => (
          <div key={assignee} className="min-h-[260px] border-r border-slate-200 bg-white last:border-r-0">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="truncate text-xs font-semibold text-slate-700">{assignee}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{list.length} scheduled</div>
            </div>
            <div className="space-y-1.5 p-2">
              {list.map((it) => (
                <ScheduleBlock key={it.id} item={it} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleBlock({ item, onSelect, compact }: { item: Placed; onSelect?: (id: string) => void; compact?: boolean }) {
  const { type, recipient } = titleParts(item.title);
  const Icon = item.visitMode ? VISIT_ICON[item.visitMode] : item.kind ? KIND_ICON[item.kind] : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.id)}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-colors",
        scheduleTone(item),
        compact ? "min-h-10" : "min-h-11"
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className="shrink-0 opacity-70" />}
        <span className="min-w-0 truncate text-[11px] font-semibold">{recipient || type}</span>
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-75">
        {hhmm(item.hour, item.minute)}
        {item.assignee ? ` · ${item.assignee}` : ""}
      </div>
    </button>
  );
}

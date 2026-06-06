"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Boxes, Check, ChevronLeft, ChevronRight, Compass, HeartPulse, Home, PhoneCall, Soup, Truck, UserRound, Video, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleStatus } from "@/lib/schedule";

export type PreferredScheduleSlot = {
  iso: string;
  label: string;
  durationMinutes?: number;
};

export type SchedulePlacement = {
  itemId: string;
  scheduledFor: string;
  assignee?: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  when: string /* ISO */;
  meta?: string;
  assignee?: string;
  status?: string;
  scheduleStatus?: ScheduleStatus;
  visitMode?: "home" | "video" | "phone";
  priority?: "High" | "Medium" | "Low";
  kind?: "supplies" | "food" | "welfare" | "transport" | "referral";
  preferredSlot?: PreferredScheduleSlot;
  durationMinutes?: number;
};

type Placed = ScheduleItem & {
  dateKey: string;
  hour: number;
  minute: number;
  ms: number;
};

type PreferredZone = PreferredScheduleSlot & {
  itemId: string;
  title: string;
  dateKey: string;
  hour: number;
  minute: number;
  ms: number;
};

type LaidOutBlock = Placed & {
  column: number;
  columnCount: number;
};

type DragState = {
  candidateIso: string;
  valid: boolean;
};

const START_HOUR = 9;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SLOT_HEIGHT = 54;
const DAY_MS = 86_400_000;
const SESSION_DURATION_MINUTES = 60;

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

function minutesSinceSgtDayStart(ms: number) {
  return hourOf(ms) * 60 + minuteOf(ms);
}

function normalizePlaced(it: ScheduleItem): Placed {
  const ms = new Date(it.when).getTime();
  return { ...it, dateKey: dateKey(ms), hour: hourOf(ms), minute: minuteOf(ms), ms };
}

function normalizePreferredZone(item: ScheduleItem): PreferredZone | null {
  if (!item.preferredSlot) return null;
  const ms = new Date(item.preferredSlot.iso).getTime();
  if (Number.isNaN(ms)) return null;
  return {
    ...item.preferredSlot,
    itemId: item.id,
    title: item.title,
    dateKey: dateKey(ms),
    hour: hourOf(ms),
    minute: minuteOf(ms),
    ms,
  };
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

function zoneOffset(zone: PreferredZone) {
  return Math.max(0, ((zone.hour - START_HOUR) * 60 + zone.minute) / 60) * SLOT_HEIGHT;
}

function zoneHeight(zone: PreferredZone) {
  return Math.max(22, ((zone.durationMinutes ?? 90) / 60) * SLOT_HEIGHT);
}

function placedFromPlacement(item: ScheduleItem, placement: SchedulePlacement): Placed {
  const ms = new Date(placement.scheduledFor).getTime();
  return {
    ...item,
    when: placement.scheduledFor,
    assignee: placement.assignee?.trim() || item.assignee,
    dateKey: dateKey(ms),
    hour: hourOf(ms),
    minute: minuteOf(ms),
    ms,
  };
}

function isoFromGridPoint(root: HTMLElement, clientX: number, clientY: number) {
  const columns = [...root.querySelectorAll<HTMLElement>("[data-day-ms]")];
  const column = columns.find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right;
  });
  if (!column) return null;

  const dayMs = Number(column.dataset.dayMs);
  if (!Number.isFinite(dayMs)) return null;
  const rect = column.getBoundingClientRect();
  const y = Math.min(Math.max(clientY - rect.top, 0), HOURS.length * SLOT_HEIGHT - 1);
  const minutesFromStart = Math.round((y / SLOT_HEIGHT) * 60 / 15) * 15;
  const clampedMinutes = Math.min(minutesFromStart, (END_HOUR - START_HOUR) * 60 - SESSION_DURATION_MINUTES);
  return new Date(dayMs + (START_HOUR * 60 + clampedMinutes) * 60_000).toISOString();
}

function durationMinutesFor(item: ScheduleItem) {
  return item.durationMinutes ?? SESSION_DURATION_MINUTES;
}

function eventEndMs(item: ScheduleItem | Placed) {
  return new Date(item.when).getTime() + durationMinutesFor(item) * 60_000;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function occupiesScheduleTime(item: ScheduleItem) {
  return item.scheduleStatus !== "Cancelled";
}

function isPlacementValid(candidate: Placed, rows: Placed[]) {
  const candidateStart = candidate.ms;
  const candidateEnd = eventEndMs(candidate);
  if (dateKey(candidateEnd - 1) !== candidate.dateKey) return false;
  if (minutesSinceSgtDayStart(candidateEnd) > END_HOUR * 60) return false;

  return !rows
    .filter(occupiesScheduleTime)
    .filter((row) => row.dateKey === candidate.dateKey)
    .some((row) => intervalsOverlap(candidateStart, candidateEnd, row.ms, eventEndMs(row)));
}

function layoutDayBlocks(items: Placed[]): LaidOutBlock[] {
  const sorted = [...items].sort((a, b) => a.ms - b.ms || eventEndMs(a) - eventEndMs(b));
  const visited = new Set<string>();
  const output: LaidOutBlock[] = [];

  for (const item of sorted) {
    if (visited.has(item.id)) continue;
    const group: Placed[] = [];
    const stack = [item];
    visited.add(item.id);

    while (stack.length) {
      const current = stack.pop()!;
      group.push(current);
      for (const candidate of sorted) {
        if (visited.has(candidate.id)) continue;
        if (group.some((existing) => intervalsOverlap(existing.ms, eventEndMs(existing), candidate.ms, eventEndMs(candidate)))) {
          visited.add(candidate.id);
          stack.push(candidate);
        }
      }
    }

    output.push(...layoutOverlapGroup(group));
  }

  return output.sort((a, b) => a.ms - b.ms || a.column - b.column);
}

function layoutOverlapGroup(group: Placed[]): LaidOutBlock[] {
  const columns: number[] = [];
  const assignments = new Map<string, number>();
  const sorted = [...group].sort((a, b) => a.ms - b.ms || eventEndMs(a) - eventEndMs(b));

  for (const item of sorted) {
    let column = columns.findIndex((end) => end <= item.ms);
    if (column === -1) {
      column = columns.length;
      columns.push(eventEndMs(item));
    } else {
      columns[column] = eventEndMs(item);
    }
    assignments.set(item.id, column);
  }

  const columnCount = Math.max(1, columns.length);
  return group.map((item) => ({
    ...item,
    column: assignments.get(item.id) ?? 0,
    columnCount,
  }));
}

function blockLayoutStyle(item: LaidOutBlock, minHeight = 40): CSSProperties {
  const width = 100 / item.columnCount;
  return {
    top: blockOffset(item) + 4,
    left: `calc(${item.column * width}% + 4px)`,
    width: `calc(${width}% - 8px)`,
    height: Math.max(minHeight, (durationMinutesFor(item) / 60) * SLOT_HEIGHT - 6),
  };
}

function draftBlockLayoutStyle(item: LaidOutBlock): CSSProperties {
  const width = 100 / item.columnCount;
  return {
    top: blockOffset(item) + 4,
    left: `calc(${item.column * width}% + 4px)`,
    width: `calc(${width}% - 8px)`,
    minHeight: 70,
  };
}

function scheduleTone(item: ScheduleItem) {
  if (item.scheduleStatus === "Completed") return "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100";
  if (item.scheduleStatus === "Cancelled") return "border-slate-200 bg-white text-slate-300 hover:bg-slate-50";
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
  placement,
  placementError,
  onPlaceTimeslot,
  onConfirmPlacement,
  onChooseAssignee,
  onCancelPlacement,
  className,
}: {
  items: ScheduleItem[];
  onSelect?: (id: string) => void;
  placement?: SchedulePlacement | null;
  placementError?: string | null;
  onPlaceTimeslot?: (iso: string) => void;
  onConfirmPlacement?: () => void;
  onChooseAssignee?: () => void;
  onCancelPlacement?: () => void;
  className?: string;
}) {
  const [mode, setMode] = useState<"time" | "assignee">("time");
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentWeekAnchorMs] = useState(() => Date.now());
  const [todayKey] = useState(() => dateKey(currentWeekAnchorMs));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const activeMode = placement ? "time" : mode;
  const placed = useMemo(() => items.map(normalizePlaced).filter((item) => !placement || item.id !== placement.itemId).sort((a, b) => a.ms - b.ms), [items, placement]);
  const preferredZones = useMemo(
    () => placement
      ? items
        .map(normalizePreferredZone)
        .filter((zone): zone is PreferredZone => zone !== null && zone.itemId === placement.itemId)
      : [],
    [items, placement]
  );
  const placementItem = useMemo(() => placement ? items.find((item) => item.id === placement.itemId) ?? null : null, [items, placement]);
  const effectivePlacement = placement && dragState ? { ...placement, scheduledFor: dragState.candidateIso } : placement;
  const draft = effectivePlacement && placementItem ? placedFromPlacement(placementItem, effectivePlacement) : null;
  const draftValid = draft ? isPlacementValid(draft, placed) : true;
  const placementIssue = placement ? placementError ?? (draftValid ? null : "Timeslot overlaps another session") : null;
  const canUseDraft = draftValid && !placementIssue;
  const anchorMs = draft?.ms ?? currentWeekAnchorMs;
  const start = weekStart(anchorMs) + weekOffset * 7 * DAY_MS;
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => start + i * DAY_MS), [start]);
  const weekKeys = useMemo(() => new Set(week.map(dateKey)), [week]);
  const rows = placed.filter((it) => weekKeys.has(it.dateKey) && it.hour >= START_HOUR && it.hour < END_HOUR);
  const zones = preferredZones.filter((zone) => weekKeys.has(zone.dateKey) && zone.hour >= START_HOUR && zone.hour < END_HOUR);

  useEffect(() => {
    if (!dragState || !placement || !placementItem) return;

    function handlePointerMove(event: PointerEvent) {
      const root = gridRef.current;
      if (!root) return;
      const candidateIso = isoFromGridPoint(root, event.clientX, event.clientY);
      if (!candidateIso) {
        setDragState((current) => current ? { ...current, valid: false } : current);
        return;
      }
      const candidate = placedFromPlacement(placementItem!, { ...placement!, scheduledFor: candidateIso });
      const valid = isPlacementValid(candidate, placed);
      const next = { candidateIso, valid };
      dragStateRef.current = next;
      setDragState(next);
    }

    function handlePointerUp() {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;
      if (currentDrag.valid) onPlaceTimeslot?.(currentDrag.candidateIso);
      dragStateRef.current = null;
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, onPlaceTimeslot, placed, placement, placementItem]);

  function handleBeginPlacementDrag(event: ReactPointerEvent) {
    if (!placement) return;
    event.preventDefault();
    const initial = { candidateIso: placement.scheduledFor, valid: true };
    dragStateRef.current = initial;
    setDragState(initial);
  }

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
                activeMode === m ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
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

      {placementIssue ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {placementIssue}
        </div>
      ) : null}

      {activeMode === "time" ? (
        <WeekGrid
          gridRef={gridRef}
          rows={rows}
          preferredZones={zones}
          draft={draft}
          draftValid={canUseDraft}
          week={week}
          todayKey={todayKey}
          onSelect={onSelect}
          onBeginPlacementDrag={placement ? handleBeginPlacementDrag : undefined}
          onConfirmPlacement={onConfirmPlacement}
          onChooseAssignee={onChooseAssignee}
          onCancelPlacement={onCancelPlacement}
        />
      ) : (
        <AssigneeGrid rows={rows} onSelect={onSelect} />
      )}
    </div>
  );
}

function WeekGrid({
  gridRef,
  rows,
  preferredZones,
  draft,
  draftValid,
  week,
  todayKey,
  onSelect,
  onBeginPlacementDrag,
  onConfirmPlacement,
  onChooseAssignee,
  onCancelPlacement,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  rows: Placed[];
  preferredZones: PreferredZone[];
  draft?: Placed | null;
  draftValid?: boolean;
  week: number[];
  todayKey: string;
  onSelect?: (id: string) => void;
  onBeginPlacementDrag?: (event: ReactPointerEvent) => void;
  onConfirmPlacement?: () => void;
  onChooseAssignee?: () => void;
  onCancelPlacement?: () => void;
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const r of rows) m.set(r.dateKey, [...(m.get(r.dateKey) ?? []), r]);
    return m;
  }, [rows]);
  const zonesByDay = useMemo(() => {
    const m = new Map<string, PreferredZone[]>();
    for (const zone of preferredZones) m.set(zone.dateKey, [...(m.get(zone.dateKey) ?? []), zone]);
    return m;
  }, [preferredZones]);

  return (
    <div className="overflow-x-auto thin-scrollbar rounded-lg border border-slate-200">
      <div ref={gridRef} className="grid min-w-[980px]" style={{ gridTemplateColumns: "64px repeat(7, minmax(128px, 1fr))" }}>
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
            <DayColumn
              key={key}
              dayMs={ms}
              rows={byDay.get(key) ?? []}
              preferredZones={zonesByDay.get(key) ?? []}
              draft={draft?.dateKey === key ? draft : null}
              draftValid={draft?.dateKey === key ? draftValid : true}
              today={key === todayKey}
              onSelect={onSelect}
              onBeginPlacementDrag={onBeginPlacementDrag}
              onConfirmPlacement={onConfirmPlacement}
              onChooseAssignee={onChooseAssignee}
              onCancelPlacement={onCancelPlacement}
            />
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
        <div key={h} className="h-[54px] border-b border-slate-100 pr-2 pt-1 text-right text-[11px] font-medium tabular-nums text-slate-400">
          {hhmm(h)}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  dayMs,
  rows,
  preferredZones,
  draft,
  draftValid,
  today,
  onSelect,
  onBeginPlacementDrag,
  onConfirmPlacement,
  onChooseAssignee,
  onCancelPlacement,
}: {
  dayMs: number;
  rows: Placed[];
  preferredZones: PreferredZone[];
  draft?: Placed | null;
  draftValid?: boolean;
  today?: boolean;
  onSelect?: (id: string) => void;
  onBeginPlacementDrag?: (event: ReactPointerEvent) => void;
  onConfirmPlacement?: () => void;
  onChooseAssignee?: () => void;
  onCancelPlacement?: () => void;
}) {
  const visibleRows = rows.filter((r) => r.hour >= START_HOUR && r.hour < END_HOUR);
  const layout = layoutDayBlocks(draft ? [...visibleRows, draft] : visibleRows);

  return (
    <div
      data-day-ms={dayMs}
      className={cn("relative border-r border-slate-200", today && "bg-blue-50/30")}
      style={{ height: HOURS.length * SLOT_HEIGHT }}
    >
      {HOURS.map((h) => (
        <div key={h} className="h-[54px] border-b border-slate-100" />
      ))}
      {preferredZones.map((zone) => (
        <PreferredZoneBlock key={`${zone.itemId}:${zone.iso}`} zone={zone} />
      ))}
      {layout.map((item) =>
        draft && item.id === draft.id ? (
          <DraftScheduleBlock
            key={item.id}
            item={item}
            valid={draftValid ?? true}
            onBeginPlacementDrag={onBeginPlacementDrag}
            onConfirmPlacement={onConfirmPlacement}
            onChooseAssignee={onChooseAssignee}
            onCancelPlacement={onCancelPlacement}
          />
        ) : (
          <ScheduleBlock key={item.id} item={item} onSelect={onSelect} compact />
        )
      )}
    </div>
  );
}

function PreferredZoneBlock({ zone }: { zone: PreferredZone }) {
  return (
    <div
      className="pointer-events-none absolute left-1 right-1 rounded-md border border-dashed border-amber-300 bg-amber-100/40"
      style={{ top: zoneOffset(zone) + 3, height: zoneHeight(zone) }}
      aria-label={zone.label}
    />
  );
}

function DraftScheduleBlock({
  item,
  valid,
  onBeginPlacementDrag,
  onConfirmPlacement,
  onChooseAssignee,
  onCancelPlacement,
}: {
  item: LaidOutBlock;
  valid: boolean;
  onBeginPlacementDrag?: (event: ReactPointerEvent) => void;
  onConfirmPlacement?: () => void;
  onChooseAssignee?: () => void;
  onCancelPlacement?: () => void;
}) {
  const { type, recipient } = titleParts(item.title);
  const Icon = item.visitMode ? VISIT_ICON[item.visitMode] : item.kind ? KIND_ICON[item.kind] : undefined;
  const hasAssignee = Boolean(item.assignee?.trim() && item.assignee !== "Unassigned");
  const canConfirm = valid && hasAssignee;
  return (
    <div
      onPointerDown={onBeginPlacementDrag}
      className={cn(
        "absolute z-20 cursor-grab rounded-lg border bg-white px-2 py-1.5 text-slate-800 shadow-lg ring-2 active:cursor-grabbing",
        valid ? "border-blue-300 ring-blue-400/20" : "border-red-300 ring-red-400/25"
      )}
      style={draftBlockLayoutStyle(item)}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className="shrink-0 text-blue-600" />}
        <span className="min-w-0 truncate text-[11px] font-semibold">{recipient || type}</span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-slate-500">
        {hhmm(item.hour, item.minute)}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onChooseAssignee?.();
          }}
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium hover:bg-slate-50",
            hasAssignee ? "border-slate-200 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <UserRound size={11} />
          <span className="truncate">{item.assignee || "Assignee"}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onCancelPlacement?.();
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancel timeslot edit"
          >
            <X size={13} />
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (!canConfirm) return;
              onConfirmPlacement?.();
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Confirm timeslot"
          >
            <Check size={14} />
          </button>
        </div>
      </div>
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

function ScheduleBlock({ item, onSelect, compact }: { item: Placed | LaidOutBlock; onSelect?: (id: string) => void; compact?: boolean }) {
  const { type, recipient } = titleParts(item.title);
  const Icon = item.visitMode ? VISIT_ICON[item.visitMode] : item.kind ? KIND_ICON[item.kind] : undefined;
  const layoutStyle = "column" in item ? blockLayoutStyle(item, compact ? 40 : 44) : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.id)}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-colors",
        layoutStyle && "absolute",
        scheduleTone(item),
        item.scheduleStatus === "Cancelled" && "opacity-55",
        compact ? "min-h-10" : "min-h-11"
      )}
      style={layoutStyle}
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestStatus, WorkItem } from "@/lib/contract";
import { statusStyle } from "./theme";
import { deriveUrgency } from "./format";

// Period-scoped analytics (Apple Screen Time style): a week/month selector with
// ◀ ▶ navigation; all three panels scope to the selected period. We don't store
// historical status, so a past period's funnel = those requests (by createdAt in
// range) read at their CURRENT status — the honest computation.

const FUNNEL: RequestStatus[] = ["Pending", "Accepted", "In progress", "Completed"];
const OPEN_STATUSES: RequestStatus[] = ["Pending", "Accepted", "In progress"];
const DAY = 86_400_000;

// SGT wall-clock helpers: extract components by shifting +8h; format raw instants
// with the en-SG locale (which already renders in SGT).
function comp(ms: number) {
  const d = new Date(ms + 8 * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay() };
}
const sgtDayStart = (y: number, m: number, day: number) => Date.UTC(y, m, day) - 8 * 3_600_000;

function periodRange(anchorMs: number, period: "week" | "month", offset: number) {
  const a = comp(anchorMs);
  if (period === "week") {
    const sinceMon = (a.dow + 6) % 7;
    const start = sgtDayStart(a.y, a.m, a.day - sinceMon) + offset * 7 * DAY;
    return { start, end: start + 7 * DAY };
  }
  return { start: sgtDayStart(a.y, a.m + offset, 1), end: sgtDayStart(a.y, a.m + offset + 1, 1) };
}

function rangeLabel(period: "week" | "month", start: number, end: number) {
  if (period === "month") return new Date(start).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  const last = end - DAY;
  const sMon = new Date(start).toLocaleDateString("en-SG", { month: "short" });
  const eMon = new Date(last).toLocaleDateString("en-SG", { month: "short" });
  const sDay = new Date(start).toLocaleDateString("en-SG", { day: "numeric" });
  const eDay = new Date(last).toLocaleDateString("en-SG", { day: "numeric" });
  return sMon === eMon ? `${sDay}–${eDay} ${sMon}` : `${sDay} ${sMon} – ${eDay} ${eMon}`;
}

export default function AnalyticsPanel({ items, className }: { items: WorkItem[]; className?: string }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState(0);

  const times = useMemo(() => items.map((it) => new Date(it.session.createdAt).getTime()), [items]);
  const anchorMs = useMemo(() => (times.length ? Math.max(...times) : Date.UTC(2026, 5, 5)), [times]);
  const earliestMs = useMemo(() => (times.length ? Math.min(...times) : anchorMs), [times, anchorMs]);

  const { start, end } = periodRange(anchorMs, period, offset);
  const inPeriod = useMemo(() => items.filter((it) => { const t = new Date(it.session.createdAt).getTime(); return t >= start && t < end; }), [items, start, end]);

  const counts = useMemo(() => {
    const c: Record<RequestStatus, number> = { Pending: 0, Accepted: 0, "In progress": 0, Completed: 0, Rejected: 0, Cancelled: 0 };
    for (const it of inPeriod) c[it.status] += 1;
    return c;
  }, [inPeriod]);

  const priority = useMemo(() => {
    const c = { High: 0, Medium: 0, Low: 0 };
    for (const it of inPeriod) {
      if (!OPEN_STATUSES.includes(it.status)) continue;
      c[deriveUrgency(it.task, it.session.createdAt)] += 1;
    }
    return c;
  }, [inPeriod]);
  const funnelMax = Math.max(1, ...FUNNEL.map((s) => counts[s]));

  const buckets = useMemo(() => {
    const n = Math.round((end - start) / DAY);
    const arr: { ms: number; value: number }[] = [];
    for (let i = 0; i < n; i++) {
      const ms = start + i * DAY;
      if (ms > anchorMs) break; // don't plot days that haven't passed yet
      arr.push({ ms, value: 0 });
    }
    for (const t of times) if (t >= start && t < end) { const i = Math.floor((t - start) / DAY); if (arr[i]) arr[i].value += 1; }
    return arr;
  }, [times, start, end, anchorMs]);

  const earliestStart = periodRange(earliestMs, period, 0).start;
  const prevDisabled = start <= earliestStart;
  const nextDisabled = offset >= 0;
  // Changes on every period toggle — used as a React key to replay entrance animations.
  const sig = `${period}:${offset}`;

  function setP(p: "week" | "month") { setPeriod(p); setOffset(0); }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Period header: ◀ range ▶ ............ Week | Month */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => setOffset((o) => o - 1)} disabled={prevDisabled} aria-label="Previous period"><ChevronLeft size={16} /></NavBtn>
          <span className="min-w-[140px] text-center text-sm font-semibold text-slate-700">{rangeLabel(period, start, end)}</span>
          <NavBtn onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={nextDisabled} aria-label="Next period"><ChevronRight size={16} /></NavBtn>
        </div>
        <div className="flex items-center gap-1">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setP(p)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors", period === p ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Priority">
          <PriorityDonut key={sig} counts={priority} />
        </Card>

        <Card title="Status funnel">
          <div className="space-y-1.5">
            {FUNNEL.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] text-slate-500">{s}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div key={`${sig}-${s}`} className={cn("kit-grow h-full rounded", statusStyle(s).dot)} style={{ width: `${(counts[s] / funnelMax) * 100}%` }} />
                </div>
                <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">{counts[s]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Rejected {counts.Rejected}</span>
            <span>Cancelled {counts.Cancelled}</span>
          </div>
        </Card>

        <Card title={period === "week" ? "Volume by day" : "Volume by day of month"}>
          <VolumeLine buckets={buckets} period={period} sig={sig} />
        </Card>
      </div>
    </div>
  );
}

// Even integer ticks from 0 up to (at least) max.
function niceTicks(max: number): number[] {
  const step = max <= 4 ? 1 : Math.ceil(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

function VolumeLine({ buckets, period, sig }: { buckets: { ms: number; value: number }[]; period: "week" | "month"; sig: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Guard against a stale index after the bucket count changes (week↔month).
  const s = sel != null && sel < buckets.length ? sel : null;

  const H = 140, padL = 22, padR = 10, padT = 12, padB = 20;
  const plotW = Math.max(0, w - padL - padR);
  const plotH = H - padT - padB;
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const n = buckets.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const xLabel = (ms: number, i: number) =>
    period === "week"
      ? new Date(ms).toLocaleDateString("en-SG", { weekday: "narrow" })
      : i % 5 === 0 ? new Date(ms).toLocaleDateString("en-SG", { day: "numeric" }) : "";

  const line = buckets.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b.value).toFixed(1)}`).join(" ");
  const area = w > 0 ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const clipId = `volume-wipe-${sig.replace(/[^a-z0-9_-]/gi, "-")}`;

  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg key={sig} width={w} height={H} className="block">
          <defs>
            <clipPath id={clipId}>
              <rect className="kit-line-wipe-mask" x={padL} y={0} width={plotW} height={H} />
            </clipPath>
          </defs>
          {/* y-axis gridlines + value labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="#eef2f6" strokeWidth={1} />
              <text x={0} y={y(t) + 3} fontSize={9} fill="#94a3b8">{t}</text>
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            <path d={area} fill="#3b82f6" fillOpacity={0.08} />
            <path d={line} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* true circles (1:1 px space), clickable */}
            {buckets.map((b, i) => (
              <circle
                key={b.ms}
                cx={x(i)}
                cy={y(b.value)}
                r={s === i ? 5 : 4}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth={s === i ? 2.5 : 1.5}
                className="cursor-pointer"
                onClick={() => setSel((prev) => (prev === i ? null : i))}
              >
                <title>{`${new Date(b.ms).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}: ${b.value}`}</title>
              </circle>
            ))}
          </g>
          {s != null && (
            <line x1={x(s)} x2={x(s)} y1={padT} y2={padT + plotH} stroke="#bfdbfe" strokeWidth={1} strokeDasharray="3 3" />
          )}
          {/* x labels */}
          {buckets.map((b, i) => (
            <text key={b.ms} x={x(i)} y={H - 6} fontSize={9} fill="#94a3b8" textAnchor="middle">{xLabel(b.ms, i)}</text>
          ))}
          {/* click callout */}
          {s != null && (
            <Callout x={x(s)} top={padT} text={`${new Date(buckets[s].ms).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} · ${buckets[s].value}`} width={w} />
          )}
        </svg>
      )}
    </div>
  );
}

function Callout({ x, top, text, width }: { x: number; top: number; text: string; width: number }) {
  const w = Math.max(48, text.length * 6.2 + 12);
  const cx = Math.min(width - w / 2 - 2, Math.max(w / 2 + 2, x));
  const yTop = Math.max(0, top - 18);
  return (
    <g>
      <rect x={cx - w / 2} y={yTop} width={w} height={16} rx={4} fill="#0f172a" />
      <text x={cx} y={yTop + 11} fontSize={9} fill="#ffffff" textAnchor="middle">{text}</text>
    </g>
  );
}

// High/Medium/Low priority doughnut. Total in the centre; segments coloured by
// tier (red/amber/slate); counts on hover.
function PriorityDonut({ counts }: { counts: { High: number; Medium: number; Low: number } }) {
  const tiers = [
    { key: "High", value: counts.High, color: "#ef4444" },
    { key: "Medium", value: counts.Medium, color: "#f59e0b" },
    { key: "Low", value: counts.Low, color: "#22c55e" },
  ];
  const total = tiers.reduce((s, t) => s + t.value, 0);
  const R = 40, SW = 16;
  let start = -90;
  let index = 0;
  const segments = tiers.flatMap((t) => {
    if (total === 0 || t.value === 0) return [];
    const span = (t.value / total) * 360;
    const segment = {
      ...t,
      start,
      end: start - span,
      index,
    };
    start -= span;
    index += 1;
    return [segment];
  });

  return (
    <div className="flex min-h-36 items-center justify-center gap-8">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
          {segments.map((t) => (
            <path
              key={t.key}
              d={arcPath(50, 50, R, t.start, t.end)}
              fill="none"
              stroke={t.color}
              strokeWidth={SW}
              pathLength={1}
              className="kit-donut-segment cursor-default"
              style={{ animationDelay: `${t.index * 120}ms` }}
            >
              <title>{`${t.key}: ${t.value}`}</title>
            </path>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight text-slate-900">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Total</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {tiers.map((t) => (
          <div key={t.key} className="flex min-w-20 items-center gap-2 text-xs" title={`${t.key}: ${t.value}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            <span className="text-slate-600">{t.key}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-700">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function pointOnCircle(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (Math.abs(endAngle - startAngle) >= 359.99) {
    const start = pointOnCircle(cx, cy, r, startAngle);
    const mid = pointOnCircle(cx, cy, r, startAngle - 180);
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 1 0 ${mid.x.toFixed(3)} ${mid.y.toFixed(3)} A ${r} ${r} 0 1 0 ${start.x.toFixed(3)} ${start.y.toFixed(3)}`;
  }
  const start = pointOnCircle(cx, cy, r, startAngle);
  const end = pointOnCircle(cx, cy, r, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function NavBtn({ children, onClick, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      {...rest}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ops-card p-4">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

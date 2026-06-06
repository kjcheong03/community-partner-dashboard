"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestStatus, WorkItem } from "@/lib/contract";
import EmptyState from "./EmptyState";
import FiltersTabs from "./FiltersTabs";

export type QueueColumn = {
  key: string;
  header: string;
  /** Plain value used for distinct-counting (auto-hide) + default sorting. */
  value: (it: WorkItem) => string;
  /** Cell renderer; defaults to the plain value. */
  cell?: (it: WorkItem) => ReactNode;
  /** Custom sort key (e.g. numeric rank / date) — falls back to `value`. */
  sortValue?: (it: WorkItem) => string | number;
  /** Never auto-hidden, even if every row shares one value. */
  core?: boolean;
  /** Minimum useful column width. The table expands beyond this when space allows. */
  width?: number | string;
  className?: string;
};

type SortDir = "asc" | "desc";
type QueueStatusTab = "todo" | "closed";

type Props = {
  items: WorkItem[];
  columns: QueueColumn[];
  selectedId?: string | null;
  onSelect?: (item: WorkItem) => void;
  defaultSortKey?: string;
  defaultSortDir?: SortDir;
  /** Show every column regardless of distinct-value count (kitchen-sink/preview). */
  showAllColumns?: boolean;
  /** Rows per page; additional rows are reached through the queue pager. */
  maxRows?: number;
  /** Kit-owned To do / Closed split; derived from WorkItem.status. */
  statusTabs?: boolean;
  /** Optional control rendered in the queue toolbar, before pagination. */
  toolbarAction?: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  todoEmptyTitle?: string;
  todoEmptyHint?: string;
  closedEmptyTitle?: string;
  closedEmptyHint?: string;
  className?: string;
};

const OPEN_STATUSES: RequestStatus[] = ["Pending", "Accepted", "In progress"];

export default function RequestQueue({
  items,
  columns,
  selectedId,
  onSelect,
  defaultSortKey,
  defaultSortDir = "desc",
  showAllColumns = false,
  maxRows = 8,
  statusTabs = false,
  toolbarAction,
  emptyTitle,
  emptyHint,
  todoEmptyTitle,
  todoEmptyHint,
  closedEmptyTitle,
  closedEmptyHint,
  className,
}: Props) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns[0]?.key);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [statusTab, setStatusTab] = useState<QueueStatusTab>("todo");
  const [page, setPage] = useState(0);

  const todoItems = useMemo(() => items.filter((it) => isOpenStatus(it.status)), [items]);
  const closedItems = useMemo(() => items.filter((it) => !isOpenStatus(it.status)), [items]);
  const tableItems = statusTabs ? (statusTab === "todo" ? todoItems : closedItems) : items;

  // Only necessary columns: keep core, plus any column with ≥2 distinct values.
  // (showAllColumns bypasses the pruning for the kitchen-sink preview.)
  const visible = useMemo(() => {
    if (showAllColumns) return columns;
    return columns.filter((c) => {
      if (c.core) return true;
      const seen = new Set<string>();
      for (const it of tableItems) {
        seen.add(c.value(it));
        if (seen.size >= 2) return true;
      }
      return false;
    });
  }, [columns, tableItems, showAllColumns]);

  const rows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return tableItems;
    const keyOf = col.sortValue ?? col.value;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...tableItems].sort((a, b) => {
      const va = keyOf(a);
      const vb = keyOf(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return cmp * dir;
    });
  }, [tableItems, columns, sortKey, sortDir]);

  const viewportRows = Math.max(1, maxRows);
  const pageCount = Math.max(1, Math.ceil(rows.length / viewportRows));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(currentPage * viewportRows, currentPage * viewportRows + viewportRows),
    [rows, currentPage, viewportRows]
  );

  function toggleSort(key: string) {
    setPage(0);
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc"); // first click on a new column → ascending
    }
  }

  const tabs = [
    { value: "todo", label: "To do", count: todoItems.length },
    { value: "closed", label: "Closed", count: closedItems.length },
  ];

  const currentEmptyTitle =
    statusTabs && statusTab === "todo"
      ? (todoEmptyTitle ?? emptyTitle)
      : statusTabs && statusTab === "closed"
        ? (closedEmptyTitle ?? emptyTitle)
        : emptyTitle;
  const currentEmptyHint =
    statusTabs && statusTab === "todo"
      ? (todoEmptyHint ?? emptyHint)
      : statusTabs && statusTab === "closed"
        ? (closedEmptyHint ?? emptyHint)
        : emptyHint;

  if (rows.length === 0) {
    return (
      <div className={cn((statusTabs || toolbarAction) && "space-y-3", className)}>
        {(statusTabs || toolbarAction) && (
          <QueueToolbar
            statusTabs={statusTabs ? <FiltersTabs tabs={tabs} value={statusTab} onChange={(v) => { setStatusTab(v as QueueStatusTab); setPage(0); }} /> : null}
            action={toolbarAction}
          />
        )}
        <div className="ops-card">
          <EmptyState title={currentEmptyTitle ?? "Nothing here"} hint={currentEmptyHint} />
        </div>
      </div>
    );
  }

  const interactive = Boolean(onSelect);
  const minTableWidth = visible.reduce(
    (sum, c) => sum + (typeof c.width === "number" ? c.width : 96),
    0
  );

  return (
    <div className={cn((statusTabs || pageCount > 1 || toolbarAction) && "space-y-3", className)}>
      {(statusTabs || pageCount > 1 || toolbarAction) && (
        <QueueToolbar
          statusTabs={statusTabs ? <FiltersTabs tabs={tabs} value={statusTab} onChange={(v) => { setStatusTab(v as QueueStatusTab); setPage(0); }} /> : null}
          action={toolbarAction}
          pagination={pageCount > 1 ? <PaginationControls page={currentPage} pageCount={pageCount} onPageChange={setPage} /> : null}
        />
      )}
      <div className="ops-card overflow-hidden">
        <div className="overflow-auto thin-scrollbar">
          <table className="border-collapse table-fixed text-xs" style={{ width: `max(100%, ${minTableWidth}px)` }}>
            <colgroup>
              {visible.map((c) => (
                <col
                  key={c.key}
                  style={
                    typeof c.width === "number" || c.width
                      ? { width: c.width }
                      : undefined
                  }
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                {visible.map((c) => {
                  const active = c.key === sortKey;
                  return (
                    <th key={c.key} className="min-w-0 whitespace-nowrap px-3 py-2.5 text-left font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn("flex max-w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-600", active && "text-slate-600")}
                      >
                        <span className="min-w-0 truncate">{c.header}</span>
                        {active && (
                          <span className="shrink-0">
                            {sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </span>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((it) => {
                const selected = selectedId === it.id;
                return (
                  <tr
                    key={it.id}
                    onClick={() => onSelect?.(it)}
                    className={cn(
                      "transition-colors",
                      interactive && "cursor-pointer",
                      selected ? "bg-blue-50 shadow-[inset_3px_0_0_#2563eb]" : "hover:bg-slate-50"
                    )}
                  >
                    {visible.map((c) => (
                      <td key={c.key} className={cn("h-11 min-w-0 whitespace-nowrap px-3 align-middle", c.className)}>
                        <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={c.value(it)}>
                          {c.cell ? c.cell(it) : c.value(it)}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function isOpenStatus(status: RequestStatus) {
  return OPEN_STATUSES.includes(status);
}

function QueueToolbar({
  statusTabs,
  action,
  pagination,
}: {
  statusTabs?: ReactNode;
  action?: ReactNode;
  pagination?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {statusTabs}
        {action}
      </div>
      {pagination && (
        <div className="flex items-center gap-2">
          {pagination}
        </div>
      )}
    </div>
  );
}

function PaginationControls({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-1 text-xs font-medium text-slate-500">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        aria-label="Previous page"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="min-w-9 text-center tabular-nums text-slate-600">
        {page + 1}/{pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        aria-label="Next page"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

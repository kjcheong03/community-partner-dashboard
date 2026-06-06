"use client";

import { Fragment, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Modal from "./Modal";

export type InventoryStatus = "OK" | "Low" | "Out";

export type InventoryRow = {
  id?: string;
  item: string;
  group?: string;
  available: number;
  reserved: number;
  fulfilled?: number;
  collectionPoint: string;
  lastUpdated: string;
  status: InventoryStatus;
  threshold: number;
  children?: InventoryRow[];
};

const STATUS_TONE: Record<InventoryStatus, string> = {
  OK: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  Low: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  Out: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

export default function InventoryTable({
  rows,
  locationHeader = "Collection point",
  onSaveStock,
}: {
  rows: InventoryRow[];
  locationHeader?: string;
  onSaveStock?: (row: InventoryRow, available: number, topUp: number) => Promise<void> | void;
}) {
  const [inventory, setInventory] = useState(() => rows);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [draftCount, setDraftCount] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");

  function startEdit(row: InventoryRow) {
    setEditing(row);
    setDraftCount(String(row.available));
    setTopUpAmount("");
  }

  async function saveEdit() {
    if (!editing) return;
    const correctedCount = Math.max(0, Number(draftCount) || 0);
    const topUp = Math.max(0, Number(topUpAmount) || 0);
    const nextAvailable = correctedCount + topUp;
    setInventory((current) =>
      recalculateParents(updateInventoryRow(current, rowKey(editing), {
        available: nextAvailable,
        lastUpdated: formatEditedAt(new Date()),
      }))
    );
    await onSaveStock?.(editing, nextAvailable, topUp);
    closeEdit();
  }

  function closeEdit() {
    setEditing(null);
    setDraftCount("");
    setTopUpAmount("");
  }

  return (
    <div className="overflow-x-auto thin-scrollbar rounded-lg border border-slate-200">
      <table className="w-full min-w-[880px] table-fixed border-collapse text-left text-[12.5px]">
        <ColGroup />
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <Th>Item</Th>
            <Th align="right">Available</Th>
            <Th align="right">Reserved</Th>
            <Th>{locationHeader}</Th>
            <Th>Last updated</Th>
            <Th>Status</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {inventory.map((row) => {
            const parentKey = rowKey(row);
            const isExpanded = expanded.has(parentKey);
            return (
              <Fragment key={parentKey}>
              <InventoryTr
                row={row}
                isParent={!!row.children?.length}
                isExpanded={isExpanded}
                onToggle={() => toggleExpanded(parentKey)}
                onEdit={() => startEdit(row)}
              />
              {row.children?.length ? (
                <InventoryChildrenPanel
                  rows={row.children}
                  expanded={isExpanded}
                  onEdit={startEdit}
                />
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <Modal open={!!editing} onClose={closeEdit} side="center" width={440}>
        {editing && (
          <div className="ops-card flex w-[440px] max-w-[92vw] flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Edit stock</h3>
                <p className="mt-0.5 text-xs text-slate-400">{editing.item}</p>
              </div>
              <button type="button" onClick={closeEdit} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Current stock</span>
                <input
                  type="number"
                  min={0}
                  value={draftCount}
                  onChange={(e) => setDraftCount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  aria-label={`Current stock for ${editing.item}`}
                />
              </label>

              <div>
                <span className="text-xs font-medium text-slate-500">Top up</span>
                <input
                  type="number"
                  min={0}
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  aria-label={`Top up amount for ${editing.item}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={closeEdit} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={saveEdit} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}

function ColGroup() {
  return (
    <colgroup>
      <col className="w-[25%]" />
      <col className="w-[11%]" />
      <col className="w-[10%]" />
      <col className="w-[23%]" />
      <col className="w-[16%]" />
      <col className="w-[7%]" />
      <col className="w-[8%]" />
    </colgroup>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th className={cn("border-b border-slate-200 px-3 py-2", align === "right" && "text-right")}>{children}</th>;
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <td className={cn("px-3 py-2.5 align-middle", align === "right" && "text-right")}>{children}</td>;
}

function InventoryTr({
  row,
  isParent = false,
  isChild = false,
  isExpanded = false,
  onToggle,
  onEdit,
}: {
  row: InventoryRow;
  isParent?: boolean;
  isChild?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className="bg-white">
      <Td>
        <div className={cn("flex min-w-0 items-center gap-2", isChild && "pl-7")}>
          {isParent && (
            <button
              type="button"
              onClick={onToggle}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.item}`}
            >
              <ChevronRight
                size={15}
                className={cn("transition-transform duration-300 ease-out", isExpanded && "rotate-90")}
              />
            </button>
          )}
          <span className={cn("truncate text-slate-800", isParent ? "text-[13.5px] font-semibold" : "font-medium")}>{row.item}</span>
        </div>
      </Td>
      <Td align="right">
        <span className={cn("font-mono", isParent ? "font-semibold text-slate-800" : "text-slate-700")}>{row.available}</span>
      </Td>
      <Td align="right">
        <span className="font-mono text-slate-600">{row.reserved}</span>
      </Td>
      <Td>
        <span className="text-slate-600">{row.collectionPoint}</span>
      </Td>
      <Td>
        <span className="text-slate-500">{row.lastUpdated}</span>
      </Td>
      <Td>
        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[row.status])}>
          {row.status}
        </span>
      </Td>
      <Td>
        {!isParent && (
          <button type="button" onClick={onEdit} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Edit stock
          </button>
        )}
      </Td>
    </tr>
  );
}

function InventoryChildrenPanel({
  rows,
  expanded,
  onEdit,
}: {
  rows: InventoryRow[];
  expanded: boolean;
  onEdit: (row: InventoryRow) => void;
}) {
  return (
    <tr className="bg-white">
      <td colSpan={7} className="p-0">
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <table className="w-full table-fixed border-collapse text-left text-[12.5px]">
              <ColGroup />
              <tbody className="divide-y divide-slate-100">
                {rows.map((child) => (
                  <InventoryTr
                    key={rowKey(child)}
                    row={child}
                    isChild
                    onEdit={() => onEdit(child)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

function rowKey(row: InventoryRow) {
  return row.id ?? row.item;
}

function updateInventoryRow(rows: InventoryRow[], key: string, patch: Partial<InventoryRow>): InventoryRow[] {
  return rows.map((row) => {
    if (rowKey(row) === key) {
      const available = patch.available ?? row.available;
      return { ...row, ...patch, status: deriveStatus(available, row.threshold) };
    }
    if (row.children?.length) return { ...row, children: updateInventoryRow(row.children, key, patch) };
    return row;
  });
}

function recalculateParents(rows: InventoryRow[]): InventoryRow[] {
  return rows.map((row) => {
    if (!row.children?.length) return row;
    const children = recalculateParents(row.children);
    const available = children.reduce((sum, child) => sum + child.available, 0);
    const reserved = children.reduce((sum, child) => sum + child.reserved, 0);
    const threshold = children.reduce((sum, child) => sum + child.threshold, 0);
    const lastUpdated = latestDisplayDate(children.map((child) => child.lastUpdated));
    return {
      ...row,
      children,
      available,
      reserved,
      threshold,
      lastUpdated,
      status: deriveStatus(available, threshold),
    };
  });
}

function latestDisplayDate(values: string[]) {
  return values.reduce((latest, value) => {
    const parsedLatest = Date.parse(latest);
    const parsedValue = Date.parse(value);
    if (!Number.isNaN(parsedLatest) && !Number.isNaN(parsedValue)) return parsedValue > parsedLatest ? value : latest;
    return latest;
  }, values[0] ?? "");
}

function deriveStatus(available: number, threshold: number): InventoryStatus {
  if (available === 0) return "Out";
  if (available < threshold) return "Low";
  return "OK";
}

function formatEditedAt(date: Date) {
  return date.toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

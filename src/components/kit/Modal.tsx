"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Generic overlay shell. side="right"/"left" → slide-over; side="center" →
// centered modal (ConfirmDialog etc.). Backdrop click + Escape close.
export default function Modal({
  open,
  onClose,
  side = "right",
  width = 460,
  backdrop = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left" | "center";
  width?: number;
  backdrop?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-[1000]", open && backdrop ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      {backdrop && (
        <div
          onClick={onClose}
          className={cn("absolute inset-0 bg-slate-900/20 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        />
      )}

      {side === "right" || side === "left" ? (
        <aside
          className={cn(
            "pointer-events-auto absolute top-0 h-full max-w-[92vw] transition-transform duration-200 ease-out",
            side === "right" ? "right-0" : "left-0",
            open ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full"
          )}
          style={{ width }}
        >
          <div className="h-full p-2 sm:p-3">{children}</div>
        </aside>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn("w-full transition-all duration-150 ease-out", open ? "scale-100 opacity-100" : "scale-95 opacity-0")}
            style={{ maxWidth: width }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Modal from "./Modal";

// Thin alias for the right-side variant of Modal — the request detail panel
// lives in this. Kept as its own import for readability at call sites.
export default function SlideOver({
  open,
  onClose,
  children,
  width,
  side = "right",
  backdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  side?: "left" | "right";
  backdrop?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} side={side} width={width} backdrop={backdrop}>
      {children}
    </Modal>
  );
}

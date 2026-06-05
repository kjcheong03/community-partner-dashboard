import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ title, hint, icon, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

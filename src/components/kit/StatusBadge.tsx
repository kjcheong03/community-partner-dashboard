import { cn } from "@/lib/utils";
import { statusStyle } from "./theme";

type Props = {
  /** Any canonical RequestStatus; unknown values fall back to a neutral chip. */
  status: string;
  /** Hide the leading state dot. */
  hideDot?: boolean;
  className?: string;
};

export default function StatusBadge({ status, hideDot, className }: Props) {
  const s = statusStyle(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium",
        s.pill,
        className
      )}
    >
      {!hideDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {status}
    </span>
  );
}

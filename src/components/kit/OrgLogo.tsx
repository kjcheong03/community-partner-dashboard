"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  /** Logo path under /public (e.g. "/logos/allkin.png"); falls back to a letter. */
  logo?: string;
  size?: number;
  className?: string;
};

export default function OrgLogo({ name, logo, size = 28, className }: Props) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const letter = name?.trim()?.[0]?.toUpperCase() ?? "?";
  const showLogo = Boolean(logo && failedLogo !== logo);

  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 font-semibold text-slate-500",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- /public logos, dynamic src; next/image is overkill for the prototype
        <img src={logo} alt={name} className="h-full w-full object-contain" onError={() => setFailedLogo(logo ?? null)} />
      ) : (
        letter
      )}
    </span>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WORKSPACES, type SupportGroup, type WorkspaceConfig } from "@/lib/workspaces";

const SUPPORT_GROUPS: { id: SupportGroup; title: string }[] = [
  { id: "supplies", title: "Health / emergency supplies" },
  { id: "food", title: "Food / meal support" },
  { id: "welfare", title: "Welfare check" },
  { id: "transport", title: "Assisted transport" },
  { id: "referral", title: "Care referral / navigation" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-[22px] py-[26px] text-slate-800">
      <div className="mx-auto max-w-[79rem] space-y-[26px]">
        <header className="border-b border-slate-200 pb-[18px]">
          <h1 className="text-[22px] font-semibold tracking-tight">Community Partner Dashboards</h1>
        </header>

        <div className="space-y-[22px]">
          {SUPPORT_GROUPS.map((group) => {
            const workspaces = WORKSPACES.filter((workspace) => workspace.supportGroup === group.id);
            return (
              <section key={group.id} className="space-y-[11px]">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</h2>
                <div className="grid gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
                  {workspaces.map((workspace) => (
                    <WorkspaceButton key={workspace.id} workspace={workspace} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function WorkspaceButton({ workspace }: { workspace: WorkspaceConfig }) {
  return (
    <Link
      href={`/${workspace.slug}`}
      className="group flex min-h-[88px] items-center gap-[13px] rounded-lg border border-slate-200 bg-white px-[18px] py-[13px] shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <span className="grid h-[53px] w-[53px] shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]">
        {workspace.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- small static /public logo grid
          <img src={workspace.logo} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[15px] font-semibold text-slate-500">{workspace.name.charAt(0)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold text-slate-800">{workspace.name}</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  );
}

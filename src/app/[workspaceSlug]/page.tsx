import { notFound } from "next/navigation";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";
import { WORKSPACES, getWorkspaceBySlug } from "@/lib/workspaces";

export function generateStaticParams() {
  return WORKSPACES.map((workspace) => ({ workspaceSlug: workspace.slug }));
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = getWorkspaceBySlug(workspaceSlug);

  if (!workspace) notFound();

  return <WorkspaceDashboard workspace={workspace} />;
}

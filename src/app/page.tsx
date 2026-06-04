"use client";

import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { HelpRequest, Topic } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import { emergencyTopics } from "@/data/emergencyTopics";
import { getOrg, requestsForOrg, type OrgId } from "@/lib/orgs";
import type { Facility } from "@/data/facilities";
import TopNav from "@/components/TopNav";
import EmergencyTopics from "@/components/EmergencyTopics";
import StatCards from "@/components/StatCards";
import AgencyReadinessPanel from "@/components/AgencyReadinessPanel";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";

const OperationsMap = dynamic(() => import("@/components/OperationsMap"), { ssr: false });
const HIDDEN_QUEUE_STATUSES = new Set(["Fulfilled"]);
const MIN_MAP_WIDTH = 36;
const MAX_MAP_WIDTH = 74;

export default function DashboardPage() {
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [org, setOrg] = useState<OrgId>("AIC");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<"All" | Topic>("All");
  const [mapWidth, setMapWidth] = useState(56);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const orgRequests = useMemo(() => requestsForOrg(requests, org), [requests, org]);
  const activeRequests = useMemo(
    () => orgRequests.filter((r) => !HIDDEN_QUEUE_STATUSES.has(r.status)),
    [orgRequests]
  );
  const topicRequests = useMemo(
    () => activeRequests.filter((r) => selectedTopic === "All" || r.topic === selectedTopic),
    [activeRequests, selectedTopic]
  );
  const selectedRequest = activeRequests.find((r) => r.id === selectedId) ?? null;

  function handleUpdate(id: string, updates: Partial<HelpRequest>) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function handleRoute(req: HelpRequest, facility: Facility) {
    handleUpdate(req.id, {
      assignedUnit: facility.name,
      assignedOrganisation: org === "AIC" ? req.assignedOrganisation : getOrg(org).name,
      activityLog: [
        ...req.activityLog,
        {
          timestamp: new Date().toISOString(),
          action: `Routed to assigned unit: ${facility.name}`,
          actor: org,
        },
      ],
    });
  }

  function handleChangeOrg(next: OrgId) {
    setOrg(next);
    setSelectedId(null);
    setSelectedTopic("All");
  }

  function updatePaneWidth(clientX: number) {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setMapWidth(Math.min(MAX_MAP_WIDTH, Math.max(MIN_MAP_WIDTH, next)));
  }

  function handleResizeStart(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    updatePaneWidth(e.clientX);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (event: PointerEvent) => updatePaneWidth(event.clientX);
    const onUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <TopNav org={org} onChangeOrg={handleChangeOrg} />

      <main className="flex-1 overflow-y-auto thin-scrollbar">
        <div className="p-4 flex flex-col gap-3">
          <EmergencyTopics
            org={org}
            requests={activeRequests}
            topics={emergencyTopics}
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
          />

          <StatCards org={org} requests={activeRequests} />

          <AgencyReadinessPanel org={org} />

          <div
            ref={workspaceRef}
            className="flex flex-col gap-3 lg:grid lg:gap-0 lg:h-[640px]"
            style={{ gridTemplateColumns: `${mapWidth}fr 12px ${100 - mapWidth}fr` }}
          >
            <div className="min-h-[420px] min-w-0 flex">
              <OperationsMap
                org={org}
                requests={topicRequests}
                selectedId={selectedId}
                selectedRequest={selectedRequest}
                onRoute={handleRoute}
                onSelectRequest={(req) => setSelectedId(selectedId === req.id ? null : req.id)}
              />
            </div>

            <div className="hidden lg:flex items-stretch justify-center">
              <button
                type="button"
                onPointerDown={handleResizeStart}
                className="group flex h-full w-3 cursor-col-resize items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Resize map and request queue"
                aria-orientation="vertical"
                role="separator"
              >
                <span className="h-16 w-1 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-400" />
              </button>
            </div>

            <div className="min-h-[380px] min-w-0 flex">
              <RequestQueue
                org={org}
                requests={activeRequests}
                selectedId={selectedId}
                selectedTopic={selectedTopic}
                onSelectTopic={setSelectedTopic}
                onSelect={(req) => setSelectedId(selectedId === req.id ? null : req.id)}
              />
            </div>
          </div>
        </div>
      </main>

      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          org={org}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

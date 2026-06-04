"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { HelpRequest, Topic } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import { emergencyTopics } from "@/data/emergencyTopics";
import { getOrg, requestsForOrg, type OrgId } from "@/lib/orgs";
import type { Facility } from "@/data/facilities";
import TopNav from "@/components/TopNav";
import EmergencyTopics from "@/components/EmergencyTopics";
import StatCards from "@/components/StatCards";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";

const OperationsMap = dynamic(() => import("@/components/OperationsMap"), { ssr: false });
const HIDDEN_QUEUE_STATUSES = new Set(["Fulfilled"]);

export default function DashboardPage() {
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [org, setOrg] = useState<OrgId>("AIC");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<"All" | Topic>("All");

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

          <div className="flex flex-col lg:flex-row gap-3 lg:h-[640px]">
            <div className="lg:flex-[1.5] min-h-[420px] flex">
              <OperationsMap
                org={org}
                requests={topicRequests}
                selectedId={selectedId}
                selectedRequest={selectedRequest}
                onRoute={handleRoute}
                onSelectRequest={(req) => setSelectedId(selectedId === req.id ? null : req.id)}
              />
            </div>

            <div className="lg:w-[46%] lg:max-w-[680px] min-h-[380px] flex">
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

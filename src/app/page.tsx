"use client";

import { useState } from "react";
import type { HelpRequest, Topic } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import TopNav from "@/components/TopNav";
import KpiRow from "@/components/KpiRow";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";
import AreaMap from "@/components/AreaMap";
import CommunityInsights from "@/components/CommunityInsights";

export default function DashboardPage() {
  const [topic, setTopic] = useState<Topic>("COVID-19");
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  function handleUpdate(id: string, updates: Partial<HelpRequest>) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function handleSelect(req: HelpRequest) {
    setSelectedId(selectedId === req.id ? null : req.id);
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-100">
      <TopNav
        selected={topic}
        onChange={(t) => { setTopic(t); setSelectedId(null); }}
      />

      {/* Content — fills remaining viewport height without scrolling */}
      <div className="flex-1 flex flex-col gap-3 p-4 min-h-0">
        <KpiRow requests={requests} topic={topic} />

        {/* 2-column body */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Left — Request Queue */}
          <div className="flex-[3] min-w-0 flex flex-col">
            <RequestQueue
              requests={requests}
              topic={topic}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>

          {/* Right — Area Map + Insights */}
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            <AreaMap requests={requests} topic={topic} />
            <CommunityInsights requests={requests} topic={topic} />
          </div>
        </div>
      </div>

      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

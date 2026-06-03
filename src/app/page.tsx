"use client";

import { useState } from "react";
import type { HelpRequest, Topic } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import TopNav from "@/components/TopNav";
import KpiRow from "@/components/KpiRow";
import SingaporeHeatmap from "@/components/SingaporeHeatmap";
import AreaSummary from "@/components/AreaSummary";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";

export default function DashboardPage() {
  const [topic, setTopic] = useState<Topic>("COVID-19");
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const topicRequests = requests.filter((r) => r.topic === topic);
  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  function handleUpdate(id: string, updates: Partial<HelpRequest>) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function handleSelectArea(area: string | null) {
    setSelectedArea(area);
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <TopNav
        selected={topic}
        onChange={(t) => { setTopic(t); setSelectedArea(null); setSelectedId(null); }}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* KPI strip — Singapore-wide */}
          <KpiRow requests={requests} topic={topic} />

          {/* Heatmap */}
          <SingaporeHeatmap
            requests={requests}
            topic={topic}
            selectedArea={selectedArea}
            onSelectArea={handleSelectArea}
          />

          {/* Area summary — conditional on selection */}
          {selectedArea && (
            <AreaSummary
              area={selectedArea}
              requests={topicRequests}
            />
          )}

          {/* Request triage table */}
          <RequestQueue
            requests={requests}
            topic={topic}
            selectedArea={selectedArea}
            selectedId={selectedId}
            onSelect={(req) => setSelectedId(selectedId === req.id ? null : req.id)}
          />
        </div>
      </main>

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

"use client";

import { useState } from "react";
import type { HelpRequest } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import TopNav from "@/components/TopNav";
import SingaporeHeatmap from "@/components/SingaporeHeatmap";
import AreaSummary from "@/components/AreaSummary";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";

export default function DashboardPage() {
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      <TopNav />

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          <SingaporeHeatmap
            requests={requests}
            selectedArea={selectedArea}
            onSelectArea={handleSelectArea}
          />

          {selectedArea && (
            <AreaSummary area={selectedArea} requests={requests} />
          )}

          <RequestQueue
            requests={requests}
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

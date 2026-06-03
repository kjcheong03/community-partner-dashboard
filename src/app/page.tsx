"use client";

import { useState } from "react";
import type { HelpRequest, Topic } from "@/lib/types";
import { mockRequests } from "@/data/mockRequests";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import TopicSwitcher from "@/components/TopicSwitcher";
import KpiRow from "@/components/KpiRow";
import RequestQueue from "@/components/RequestQueue";
import RequestDetailDrawer from "@/components/RequestDetailDrawer";
import CommunityInsights from "@/components/CommunityInsights";

export default function DashboardPage() {
  const [topic, setTopic] = useState<Topic>("COVID-19");
  const [requests, setRequests] = useState<HelpRequest[]>(mockRequests);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  function handleUpdate(id: string, updates: Partial<HelpRequest>) {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }

  function handleSelect(req: HelpRequest) {
    setSelectedId(selectedId === req.id ? null : req.id);
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <TopicSwitcher
          selected={topic}
          onChange={(t) => {
            setTopic(t);
            setSelectedId(null);
          }}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          <KpiRow requests={requests} topic={topic} />

          <RequestQueue
            requests={requests}
            topic={topic}
            selectedId={selectedId}
            onSelect={handleSelect}
          />

          <CommunityInsights requests={requests} topic={topic} />
        </main>
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

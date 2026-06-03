"use client";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import type { HelpRequest, Topic } from "@/lib/types";
import { areaMarkers } from "@/data/areaMarkers";
import "leaflet/dist/leaflet.css";

type Props = {
  requests: HelpRequest[];
  selectedArea: string | null;
  selectedTopic: "All" | Topic;
  onSelectArea: (area: string | null) => void;
};

function getAreaStats(areaName: string, requests: HelpRequest[]) {
  const areaReqs = requests.filter((r) => r.area === areaName);
  const openReqs = areaReqs.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status));
  const highPriority = openReqs.filter((r) => r.urgency === "High").length;
  return {
    total: areaReqs.length,
    openCount: openReqs.length,
    highPriority,
    hasHigh: highPriority > 0,
  };
}

function getMarkerColor(openCount: number, hasHigh: boolean): string {
  if (openCount === 0) return "#d1d5db"; // grey for no requests
  if (hasHigh) return "#dc2626"; // red for high-priority
  if (openCount >= 5) return "#ea580c"; // orange for elevated demand
  return "#3b82f6"; // blue for active
}

function createMarkerIcon(color: string, count: number, isSelected: boolean) {
  const size = isSelected ? 44 : 36;
  const fontSize = isSelected ? 16 : 14;

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background-color: ${color};
        border: ${isSelected ? 3 : 2}px solid ${isSelected ? "#1e40af" : "#475569"};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: ${fontSize}px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">
        ${count}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: "custom-marker",
  });
}

export default function SingaporeHeatmap({ requests, selectedArea, selectedTopic, onSelectArea }: Props) {
  const filteredRequests = requests.filter((r) => selectedTopic === "All" || r.topic === selectedTopic);
  const totalOpen = filteredRequests.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 relative z-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Singapore Needs Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedArea
              ? `${selectedArea} selected — click again to deselect`
              : `${totalOpen} open requests across all areas · click a marker to filter`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ea580c" }} />
            Elevated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#dc2626" }} />
            High priority
          </span>
        </div>
      </div>

      <div style={{ height: 320 }} className="rounded-lg overflow-hidden border border-slate-200">
        <MapContainer
          center={[1.35, 103.82]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
          scrollWheelZoom={true}
          dragging={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={13}
          />

          {areaMarkers.map((marker) => {
            const stats = getAreaStats(marker.name, filteredRequests);
            const isSelected = selectedArea === marker.name;
            const shouldHide = stats.openCount === 0 && selectedTopic !== "All";
            const color = getMarkerColor(stats.openCount, stats.hasHigh);

            if (shouldHide) return null;

            const icon = createMarkerIcon(color, stats.openCount, isSelected);

            const unfulfilledCount = filteredRequests
              .filter((r) => r.area === marker.name)
              .filter((r) => r.status === "Unable To Fulfil").length;

            return (
              <Marker
                key={marker.name}
                position={[marker.lat, marker.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectArea(isSelected ? null : marker.name),
                }}
                title={marker.name}
              >
                <Tooltip
                  permanent={false}
                  interactive={true}
                  className="custom-tooltip"
                  direction="top"
                  offset={[0, -10]}
                >
                  <div style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                    <strong>{marker.name}</strong>
                    <br />
                    {stats.openCount} Active Requests
                    <br />
                    {stats.highPriority} High Priority
                    <br />
                    {unfulfilledCount} Unfulfilled
                  </div>
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

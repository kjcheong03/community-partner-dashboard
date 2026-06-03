"use client";

import L from "leaflet";
import type GeoJSON from "geojson";
import { MapContainer, TileLayer, GeoJSON as GeoJSONLayer } from "react-leaflet";
import type { HelpRequest } from "@/lib/types";
import { singaporeGeoJSON } from "@/data/singaporeGeoJSON";
import "leaflet/dist/leaflet.css";

type Props = {
  requests: HelpRequest[];
  selectedArea: string | null;
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

function getAreaColor(areaName: string, requests: HelpRequest[], selectedArea: string | null): string {
  const { openCount, hasHigh } = getAreaStats(areaName, requests);

  if (selectedArea && areaName !== selectedArea) {
    return "#e0e7ff"; // lighter blue when not selected but others are
  }

  if (hasHigh && openCount > 0) return "#fee2e2"; // light red for high urgency
  if (openCount >= 4) return "#3b82f6"; // bright blue for high volume
  if (openCount >= 2) return "#93c5fd"; // medium blue
  if (openCount === 1) return "#bfdbfe"; // light blue
  return "#f1f5f9"; // very light grey for no requests
}

export default function SingaporeHeatmap({ requests, selectedArea, onSelectArea }: Props) {
  const totalOpen = requests.filter((r) => !["Fulfilled", "Unable To Fulfil", "Rerouted"].includes(r.status)).length;

  const onEachFeature = (feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string; area: string }>, layer: L.GeoJSON) => {
    const areaName = feature.properties?.name ?? "";
    const stats = getAreaStats(areaName, requests);
    const isSelected = selectedArea === areaName;

    // Set initial styling
    layer.setStyle({
      color: isSelected ? "#2563eb" : "#94a3b8",
      weight: isSelected ? 3 : 2,
      opacity: isSelected ? 1 : 0.7,
      fillColor: getAreaColor(areaName, requests, selectedArea),
      fillOpacity: isSelected ? 0.8 : 0.6,
    });

    // Hover effects
    layer.on("mouseover", () => {
      layer.setStyle({
        weight: 3,
        fillOpacity: 0.85,
        opacity: 1,
      });
      layer.bringToFront();
    });

    layer.on("mouseout", () => {
      const isSel = selectedArea === areaName;
      layer.setStyle({
        weight: isSel ? 3 : 2,
        fillOpacity: isSel ? 0.8 : 0.6,
        opacity: isSel ? 1 : 0.7,
      });
    });

    // Click to select
    layer.on("click", () => {
      onSelectArea(isSelected ? null : areaName);
    });

    // Tooltip on hover
    const tooltip = `<strong>${areaName}</strong><br/>
      Open: ${stats.openCount}<br/>
      High Priority: ${stats.highPriority}<br/>
      Total: ${stats.total}`;
    layer.bindPopup(tooltip, { closeButton: false, autoPan: false });
    layer.on("mouseover", () => layer.openPopup());
    layer.on("mouseout", () => layer.closePopup());
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Singapore Needs Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedArea
              ? `${selectedArea} selected — click again to deselect`
              : `${totalOpen} open requests across all areas · click an area to filter`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1" }} />
            Quiet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#93c5fd", border: "1px solid #3b82f6" }} />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#fee2e2", border: "1px solid #f87171" }} />
            High urgency
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
          <GeoJSONLayer key={`geojson-${selectedArea}`} data={singaporeGeoJSON} onEachFeature={onEachFeature} />
        </MapContainer>
      </div>
    </div>
  );
}

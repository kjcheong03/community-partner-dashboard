"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L, { type Layer, type PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

// Choropleth over Singapore planning areas, shaded by request density. Generic:
// feed it { region, count }[] + a GeoJSON of region polygons (properties.name).
// Region matching is case-insensitive. Load via dynamic({ ssr: false }).

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const RAMP = ["#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8"];

function shade(count: number, max: number): string {
  if (count <= 0 || max <= 0) return "#eef2f6";
  const idx = Math.min(RAMP.length - 1, Math.floor((count / max) * RAMP.length));
  return RAMP[idx];
}

// Anchor the view to Singapore: lock panning to the geojson extent and set a
// min-zoom so you can't zoom out past the whole country; then frame the initial
// view on the regions that actually carry data.
function FitBounds({ geojson, active }: { geojson: FeatureCollection; active: Set<string> }) {
  const map = useMap();
  useEffect(() => {
    try {
      const full = L.geoJSON(geojson).getBounds();
      if (full.isValid()) {
        const padded = full.pad(0.04);
        map.setMaxBounds(padded);
        map.setMinZoom(map.getBoundsZoom(padded)); // can't zoom out past all of SG
      }
      const subset =
        active.size > 0
          ? { ...geojson, features: geojson.features.filter((f) => active.has(((f.properties as { name?: string })?.name ?? "").toLowerCase())) }
          : geojson;
      const bounds = L.geoJSON(subset.features.length ? subset : geojson).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    } catch {
      /* ignore */
    }
  }, [geojson, active, map]);
  return null;
}

type Props = {
  data: { region: string; count: number }[];
  geojson: FeatureCollection;
  onRegionClick?: (region: string) => void;
  height?: number;
  className?: string;
};

export default function MapHeatmap({ data, geojson, onRegionClick, height = 420, className }: Props) {
  const counts = useMemo(() => new Map(data.map((d) => [d.region.toLowerCase(), d.count])), [data]);
  const max = useMemo(() => data.reduce((m, d) => Math.max(m, d.count), 0), [data]);
  const layerKey = useMemo(() => data.map((d) => `${d.region}:${d.count}`).join("|"), [data]);

  const countFor = (feature?: Feature) =>
    counts.get(((feature?.properties as { name?: string } | undefined)?.name ?? "").toLowerCase()) ?? 0;

  const styleFn = (feature?: Feature): PathOptions => ({
    fillColor: shade(countFor(feature), max),
    fillOpacity: 0.72,
    weight: 0.8,
    color: "#ffffff",
  });

  const onEach = (feature: Feature, layer: Layer) => {
    const name = (feature.properties as { name?: string } | undefined)?.name ?? "";
    const c = countFor(feature);
    layer.bindTooltip(`${name}: ${c} request${c === 1 ? "" : "s"}`, { sticky: true });
    if (onRegionClick) {
      const path = layer as L.Path;
      path.on("click", () => onRegionClick(name));
      path.on("mouseover", () => path.setStyle({ weight: 2, color: "#1d4ed8" }));
      path.on("mouseout", () => path.setStyle({ weight: 0.8, color: "#ffffff" }));
      if (path.getElement) path.getElement()?.setAttribute("style", "cursor:pointer");
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* `isolate` contains Leaflet's internal z-indices (panes/controls go up to
          1000) so the map can't paint over an overlay like the request slide-over. */}
      <div className="relative isolate overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
        <MapContainer
          center={[1.355, 103.82]}
          zoom={11}
          maxZoom={15}
          maxBoundsViscosity={1}
          style={{ height: "100%", width: "100%", background: "#f8fafc" }}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url={TILE_URL} tileSize={MAPBOX_TOKEN ? 512 : 256} zoomOffset={MAPBOX_TOKEN ? -1 : 0} opacity={0.85} />
          <GeoJSON key={layerKey} data={geojson} style={styleFn} onEachFeature={onEach} />
          <FitBounds geojson={geojson} active={new Set(counts.keys())} />
        </MapContainer>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>0</span>
        <span className="h-3 w-5 rounded-sm" style={{ background: shade(0, max) }} />
        {RAMP.map((c) => (
          <span key={c} className="h-3 w-5 rounded-sm" style={{ background: c }} />
        ))}
        <span>{max}</span>
        <span className="ml-1">requests / area</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, Polyline, useMap } from "react-leaflet";
import type { HelpRequest } from "@/lib/types";
import type { OrgId } from "@/lib/orgs";
import { getOrg } from "@/lib/orgs";
import { facilitiesForOrg, ownFacilities, areaLatLng, FACILITY_LABEL, ownFacilityLabel, type Facility, type FacilityType } from "@/data/facilities";
import { caseDomainColor, cn, statusColor, urgencyColor } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAPBOX_TILE_URL = MAPBOX_ACCESS_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/">Improve this map</a>';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAP_RENDER_VERSION = Date.now().toString(36);

type Props = {
  org: OrgId;
  requests: HelpRequest[];
  selectedId: string | null;
  onSelectRequest: (req: HelpRequest) => void;
  selectedRequest?: HelpRequest | null;
  onRoute?: (req: HelpRequest, facility: Facility) => void;
};

// Which facility field a partner org routes a request to.
function assignedFacilityName(org: OrgId, r: HelpRequest): string | undefined {
  return org === "AIC" ? undefined : r.assignedUnit;
}

const CLOSED = new Set(["Fulfilled", "Unable To Fulfil", "Rerouted"]);

const FACILITY_STYLE: Record<FacilityType, { bg: string; glyph: string }> = {
  hub: { bg: "#1e3a8a", glyph: "AIC" },
  office: { bg: "#4f46e5", glyph: "VC" },
  outreach: { bg: "#7e22ce", glyph: "SG" },
  support: { bg: "#15803d", glyph: "SS" },
  care: { bg: "#0d9488", glyph: "CS" },
  clinic: { bg: "#be123c", glyph: "+" },
};

function facilityIcon(f: Facility, opts: { assigned?: boolean; target?: boolean } = {}) {
  const { bg, glyph } = FACILITY_STYLE[f.type];
  const big = opts.assigned || opts.target;
  const size = big ? 28 : 22;
  const border = opts.assigned ? "3px solid #1e40af" : opts.target ? "3px dashed #1e40af" : "2px solid #fff";
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:6px;box-sizing:border-box;overflow:hidden;white-space:nowrap;
      background:${bg};color:#fff;font:700 ${big ? 10 : 9}px/${size - 6}px system-ui;text-align:center;
      border:${border};box-shadow:0 1px 4px rgba(0,0,0,.4);
    ">${glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: "cara-facility-marker",
  });
}

type AreaGroup = {
  area: string;
  lat: number;
  lng: number;
  requests: HelpRequest[];
};

const AREA_TONE = {
  active: { color: "#2563eb", label: "Active" },
  elevated: { color: "#f59e0b", label: "Elevated" },
  high: { color: "#dc2626", label: "High priority" },
  resolved: { color: "#94a3b8", label: "Resolved" },
} as const;

function areaTone(requests: HelpRequest[]) {
  const open = requests.filter((r) => !CLOSED.has(r.status));
  if (open.length === 0) return AREA_TONE.resolved;
  if (open.some((r) => r.urgency === "High")) return AREA_TONE.high;
  if (open.some((r) => r.urgency === "Medium")) return AREA_TONE.elevated;
  return AREA_TONE.active;
}

function areaCaseIcon(group: AreaGroup, selected: boolean) {
  const count = group.requests.length;
  const tone = areaTone(group.requests);
  const size = selected ? 38 : 34;
  const fontSize = count > 9 ? 14 : 15;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${tone.color};color:#fff;
      border:${selected ? 3 : 2}px solid ${selected ? "#1d4ed8" : "#ffffff"};
      box-shadow:0 2px 6px rgba(15,23,42,.36);
      display:flex;align-items:center;justify-content:center;
      font:800 ${fontSize}px/${size}px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: "cara-area-marker",
  });
}

function caseSort(a: HelpRequest, b: HelpRequest) {
  const urgencyRank = { High: 0, Medium: 1, Low: 2 };
  const urgencyDelta = urgencyRank[a.urgency] - urgencyRank[b.urgency];
  if (urgencyDelta !== 0) return urgencyDelta;
  return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
}

function domainCounts(requests: HelpRequest[]) {
  return {
    A: requests.filter((r) => r.caseDomain === "A").length,
    B: requests.filter((r) => r.caseDomain === "B").length,
    C: requests.filter((r) => r.caseDomain === "C").length,
  };
}

function ResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function OperationsMap({ org, requests, selectedId, onSelectRequest, selectedRequest, onRoute }: Props) {
  const orgConfig = getOrg(org);
  const facilities = useMemo(() => facilitiesForOrg(org), [org]);

  const areaGroups = useMemo(() => {
    const byArea = new Map<string, HelpRequest[]>();
    for (const r of requests) {
      const arr = byArea.get(r.area) ?? [];
      arr.push(r);
      byArea.set(r.area, arr);
    }
    const out: AreaGroup[] = [];
    for (const [area, reqs] of byArea.entries()) {
      const base = areaLatLng(area);
      if (!base) continue;
      out.push({ area, lat: base.lat, lng: base.lng, requests: reqs });
    }
    return out.sort((a, b) => b.requests.length - a.requests.length || a.area.localeCompare(b.area));
  }, [requests]);

  const openCount = requests.filter((r) => !CLOSED.has(r.status)).length;

  // Routing mode: a request is selected and this org can route it.
  const canRoute = org !== "AIC" && !!onRoute;
  const routingReq = canRoute ? selectedRequest ?? null : null;
  const ownIds = useMemo(() => new Set(ownFacilities(org).map((f) => f.id)), [org]);
  const assignedName = routingReq ? assignedFacilityName(org, routingReq) : undefined;
  const selectedPos = routingReq ? areaLatLng(routingReq.area) : null;
  const assignedFacility = assignedName ? facilities.find((f) => f.name === assignedName) ?? null : null;
  const mapKey = `${org}-${MAP_RENDER_VERSION}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-full min-h-[360px] w-full">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Operations Map — {orgConfig.shortName}</h2>
          {routingReq ? (
            <p className="text-xs text-blue-600 mt-0.5 font-medium">
              Routing {routingReq.id} · click a {ownFacilityLabel(org)} marker to assign
              {assignedFacility ? ` · now: ${assignedFacility.name}` : ""}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              {openCount} open request{openCount === 1 ? "" : "s"} · {areaGroups.length} area
              {areaGroups.length === 1 ? "" : "s"} with cases · click a numbered area for detail
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <Legend color={AREA_TONE.active.color} label="Active" />
          <Legend color={AREA_TONE.elevated.color} label="Elevated" />
          <Legend color={AREA_TONE.high.color} label="High priority" />
          <Legend color={AREA_TONE.resolved.color} label="Resolved" />
          <span className="text-slate-300">|</span>
          <FacilityLegend type={ownFacilities(org)[0]?.type ?? "hub"} />
          <FacilityLegend type="clinic" />
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-b-xl overflow-hidden">
        <MapContainer
          key={mapKey}
          center={[1.345, 103.84]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          zoomControl
          scrollWheelZoom
        >
          <ResizeWatcher />

          <TileLayer
            url={MAPBOX_TILE_URL}
            attribution={MAPBOX_ACCESS_TOKEN ? MAPBOX_ATTRIBUTION : OSM_ATTRIBUTION}
            maxZoom={18}
            tileSize={MAPBOX_ACCESS_TOKEN ? 512 : 256}
            zoomOffset={MAPBOX_ACCESS_TOKEN ? -1 : 0}
          />

          {/* Connector line from the selected request to its assigned facility */}
          {selectedPos && assignedFacility && (
            <Polyline
              positions={[
                [selectedPos.lat, selectedPos.lng],
                [assignedFacility.lat, assignedFacility.lng],
              ]}
              pathOptions={{ color: "#1e40af", weight: 2, dashArray: "6 6", opacity: 0.8 }}
            />
          )}

          {/* Facility markers — org offices/branches/hubs + nearby clinics */}
          {facilities.map((f) => {
            const isOwn = ownIds.has(f.id);
            const isAssigned = assignedFacility?.id === f.id;
            const isTarget = !!routingReq && isOwn && !isAssigned;
            return (
              <Marker
                key={f.id}
                position={[f.lat, f.lng]}
                icon={facilityIcon(f, { assigned: isAssigned, target: isTarget })}
                zIndexOffset={isAssigned || isTarget ? 500 : 0}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.45, minWidth: 160 }}>
                    <strong>{f.name}</strong>
                    <br />
                    <span style={{ color: "#64748b" }}>{FACILITY_LABEL[f.type]}</span>
                    <br />
                    {f.info}
                    <br />
                    <span style={{ color: "#64748b" }}>Hours: {f.hours}</span>
                    {routingReq && isOwn && (
                      <>
                        <br />
                        {isAssigned ? (
                          <span style={{ color: "#1e40af", fontWeight: 600 }}>
                            ✓ {routingReq.id} routed here
                          </span>
                        ) : (
                          <button
                            onClick={() => onRoute?.(routingReq, f)}
                            style={{
                              marginTop: 6,
                              width: "100%",
                              padding: "5px 8px",
                              borderRadius: 6,
                              background: "#2563eb",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: 12,
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Route {routingReq.id} here
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Area case markers — one numbered badge per planning area. */}
          {areaGroups.map((group) => {
            const selected = group.requests.some((req) => req.id === selectedId);
            const tone = areaTone(group.requests);
            const highCount = group.requests.filter((req) => req.urgency === "High" && !CLOSED.has(req.status)).length;
            const domains = domainCounts(group.requests);
            const sortedRequests = [...group.requests].sort(caseSort);
            return (
              <Marker
                key={group.area}
                position={[group.lat, group.lng]}
                icon={areaCaseIcon(group, selected)}
                eventHandlers={{
                  click: () => {
                    if (group.requests.length === 1) onSelectRequest(group.requests[0]);
                  },
                }}
                zIndexOffset={selected ? 1000 : highCount > 0 ? 600 : 100}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    <strong>{group.area}</strong>
                    <br />
                    {group.requests.length} case{group.requests.length === 1 ? "" : "s"} · {tone.label}
                    {highCount > 0 ? ` · ${highCount} high priority` : ""}
                    <br />
                    A/B/C · {domains.A}/{domains.B}/{domains.C}
                  </div>
                </Tooltip>
                <Popup maxWidth={280}>
                  <div className="min-w-[220px] text-xs leading-snug">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-sm text-slate-800">{group.area}</strong>
                        <p className="mt-0.5 text-slate-500">
                          {group.requests.length} case{group.requests.length === 1 ? "" : "s"} in this area
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {highCount} high-priority case{highCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: tone.color }}
                      >
                        {tone.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-3 gap-1.5 pb-1">
                        {(["A", "B", "C"] as const).map((domain) => (
                          <div key={domain} className={cn("rounded-md border px-2 py-1", caseDomainColor(domain))}>
                            <p className="text-[10px] font-semibold">Domain {domain}</p>
                            <p className="text-sm font-bold leading-none">{domains[domain]}</p>
                          </div>
                        ))}
                      </div>
                      {sortedRequests.map((req) => (
                        <button
                          key={req.id}
                          onClick={() => onSelectRequest(req)}
                          className={cn(
                            "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                            selectedId === req.id
                              ? "border-blue-400 bg-blue-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-slate-700">{req.id}</span>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", urgencyColor(req.urgency))}>
                              {req.urgency}
                            </span>
                          </span>
                          <span className="mt-1 block text-slate-600">{req.helpType}</span>
                          <span className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-slate-400">{req.recipient.name}</span>
                            <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", caseDomainColor(req.caseDomain))}>
                              {req.caseDomain}
                            </span>
                            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", statusColor(req.status))}>
                              {req.status}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function FacilityLegend({ type }: { type: FacilityType }) {
  const { bg, glyph } = FACILITY_STYLE[type];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center rounded text-white font-bold"
        style={{ backgroundColor: bg, fontSize: 8, minWidth: 16, height: 16, padding: "0 3px" }}
      >
        {glyph}
      </span>
      {FACILITY_LABEL[type]}
    </span>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Feature } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { geocode } from "@/lib/providers/context";

export interface SitePick { lat: number; lon: number; parcelLonLat: [number, number][] | null }

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/liberty";

export default function SiteMap({ value, onChange }: { value: SitePick; onChange: (v: SitePick) => void }) {
  const ref = useRef<HTMLDivElement>(null); const mapRef = useRef<maplibregl.Map | null>(null); const markerRef = useRef<maplibregl.Marker | null>(null);
  const [mode, setMode] = useState<"origin" | "parcel">("origin");
  const [pts, setPts] = useState<[number, number][]>(value.parcelLonLat ?? []);
  const [q, setQ] = useState(""); const [hits, setHits] = useState<Array<{ label: string; lat: number; lon: number }>>([]);
  const modeRef = useRef(mode); modeRef.current = mode; const ptsRef = useRef(pts); ptsRef.current = pts; const valRef = useRef(value); valRef.current = value;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: ref.current, style: STYLE, center: [value.lon, value.lat], zoom: 16, attributionControl: { compact: true } });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    markerRef.current = new maplibregl.Marker({ color: "#38bdf8" }).setLngLat([value.lon, value.lat]).addTo(map);
    map.on("load", () => {
      map.addSource("parcel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "parcel-fill", type: "fill", source: "parcel", paint: { "fill-color": "#fbbf24", "fill-opacity": 0.2 } });
      map.addLayer({ id: "parcel-line", type: "line", source: "parcel", paint: { "line-color": "#fbbf24", "line-width": 2 } });
      map.addLayer({ id: "parcel-pts", type: "circle", source: "parcel", filter: ["==", "$type", "Point"], paint: { "circle-radius": 4, "circle-color": "#fbbf24" } });
      drawParcel(map, ptsRef.current);
    });
    map.on("click", (e) => {
      const ll: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (modeRef.current === "origin") { markerRef.current?.setLngLat(ll); onChange({ ...valRef.current, lon: ll[0], lat: ll[1] }); }
      else { const next = [...ptsRef.current, ll]; setPts(next); drawParcel(map, next); onChange({ ...valRef.current, parcelLonLat: next.length >= 3 ? next : null }); }
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawParcel(map: maplibregl.Map, p: [number, number][]) {
    const src = map.getSource("parcel") as maplibregl.GeoJSONSource | undefined; if (!src) return;
    const features: Feature[] = p.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
    if (p.length >= 3) features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...p, p[0]!]] }, properties: {} });
    else if (p.length === 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: p }, properties: {} });
    src.setData({ type: "FeatureCollection", features });
  }

  const search = async () => { if (!q.trim()) return; try { setHits(await geocode(q)); } catch { setHits([]); } };
  const goto = (h: { label: string; lat: number; lon: number }) => { mapRef.current?.flyTo({ center: [h.lon, h.lat], zoom: 17 }); markerRef.current?.setLngLat([h.lon, h.lat]); onChange({ ...value, lat: h.lat, lon: h.lon }); setHits([]); };
  const clear = () => { setPts([]); if (mapRef.current) drawParcel(mapRef.current, []); onChange({ ...value, parcelLonLat: null }); };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="flex-1 rounded bg-slate-800 px-2 py-1 text-sm" placeholder="Search address or place…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600" onClick={search}>Search</button>
      </div>
      {hits.length > 0 && <div className="rounded border border-slate-700 bg-slate-900">{hits.map((h) => <button key={h.label} className="block w-full px-2 py-1 text-left text-xs hover:bg-slate-800" onClick={() => goto(h)}>{h.label}</button>)}</div>}
      <div className="flex items-center gap-2 text-xs">
        <button className={`rounded px-2 py-1 ${mode === "origin" ? "bg-sky-600" : "bg-slate-800"}`} onClick={() => setMode("origin")}>1 · Click to set site origin</button>
        <button className={`rounded px-2 py-1 ${mode === "parcel" ? "bg-amber-600" : "bg-slate-800"}`} onClick={() => setMode("parcel")}>2 · Click parcel corners</button>
        {pts.length > 0 && <button className="rounded bg-slate-800 px-2 py-1" onClick={clear}>Clear parcel ({pts.length})</button>}
        <span className="ml-auto text-slate-500">{value.lat.toFixed(5)}, {value.lon.toFixed(5)}</span>
      </div>
      <div ref={ref} className="h-[420px] w-full overflow-hidden rounded border border-slate-800" />
      <div className="text-[11px] text-slate-500">Map tiles: OpenFreeMap (OpenStreetMap data). Set NEXT_PUBLIC_MAP_STYLE to use Mapbox or another style.</div>
    </div>
  );
}

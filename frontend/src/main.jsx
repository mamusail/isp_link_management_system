import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import App from './App.jsx'
import React from 'react';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)// ─── Map ──────────────────────────────────────────────────────────
export function POPMap({ pops }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const init = () => {
      const L = window.L;
      if (!L || !mapRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }

      const map = L.map(mapRef.current);
      instanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      map.setView([23.7000, 90.3563], 7);
      map.setMaxBounds([[20.3, 87.8], [26.8, 92.8]]);
      map.setMinZoom(7);
      map.setMaxZoom(18);

      const withCoords = pops.filter(p => p.lat != null && p.lat !== "" && p.lng != null && p.lng !== "");

      if (withCoords.length > 0) {
        withCoords.map(p => {
          const isAgg = p.type?.toLowerCase() === "aggregation";
          const isAKN = p.operator?.toUpperCase() === "AKN";
          const bgColor = isAKN ? "#2563eb" : "#16a34a";

          const iconHtml = isAgg
            ? `<div style="width:16px;height:16px;background:${bgColor};border:2.5px solid #fff;border-radius:3px;transform:rotate(45deg);box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`
            : `<div style="width:18px;height:18px;background:${bgColor};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`;

          const icon = L.divIcon({
            html: `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>`,
            className: "", iconSize: [22, 22], iconAnchor: [11, 11],
          });

          const m = L.marker([Number(p.lat), Number(p.lng)], { icon }).addTo(map);
          m.bindPopup(`
  <div style="font-family:sans-serif;min-width:160px;line-height:1.6;">
    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;">${p.name}</div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Operator:</span>
      <span style="background:${isAKN ? "#dbeafe" : "#dcfce7"};color:${bgColor};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;margin-left:2px;">${p.operator || "—"}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">POP ID:</span> <span style="font-family:monospace;color:#4f46e5;">${p.pop_id}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Type:</span>
      <span style="background:${isAgg ? "#e0f2fe" : "#ede9fe"};color:${bgColor};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-left:2px;">${p.type || "—"}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Lat:</span> ${Number(p.lat).toFixed(5)}
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Lng:</span> ${Number(p.lng).toFixed(5)}
    </div>
    ${p.notes ? `<div style="font-size:11px;color:#64748b;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;"><span style="font-weight:600;color:#475569;">Note:</span> ${p.notes}</div>` : ""}
  </div>
`);
          return m;
        });
      }
    };

    if (window.L) {
      init();
    } else {
      let script = document.getElementById("leaflet-js");
      if (!script) {
        script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [pops]);

  return <div ref={mapRef} style={{ height: "100%", width: "100%" }} />;
}


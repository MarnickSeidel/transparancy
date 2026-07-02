"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function fixLeafletIcons() {
  const proto = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string;
  };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

function MapClickLayer({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function EstimateMapPicker({
  center,
  marker,
  onPick,
}: {
  center: [number, number];
  marker: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  /** Leaflet binds to DOM nodes; render only after mount so SSR / Strict Mode remounts do not tear the app. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fixLeafletIcons();
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        className="z-0 h-64 w-full rounded-lg border border-slate-300 bg-slate-100/90 dark:bg-slate-800/50"
        aria-hidden
      />
    );
  }

  return (
    <MapContainer
      key={`${center[0].toFixed(4)},${center[1].toFixed(4)}`}
      center={center}
      zoom={13}
      className="z-0 h-64 w-full rounded-lg border border-slate-300"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickLayer onPick={onPick} />
      {marker ? <Marker position={[marker.lat, marker.lng]} /> : null}
    </MapContainer>
  );
}

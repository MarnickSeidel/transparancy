"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function FlyToCenter({
  center,
  zoom = 13,
}: {
  center: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.75 });
  }, [lat, lng, zoom, map]);
  return null;
}

function FitRadius({
  marker,
  radiusMeters,
}: {
  marker: { lat: number; lng: number };
  radiusMeters: number;
}) {
  const map = useMap();
  const { lat, lng } = marker;
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusMeters * 2);
    map.flyToBounds(bounds, { padding: [24, 24], maxZoom: 16, duration: 0.75 });
  }, [lat, lng, radiusMeters, map]);
  return null;
}

export default function EstimateMapPicker({
  center,
  marker,
  radiusMeters,
  onPick,
}: {
  center: [number, number];
  marker: { lat: number; lng: number } | null;
  radiusMeters: number;
  onPick: (lat: number, lng: number) => void;
}) {
  /** Leaflet binds to DOM nodes; render only after mount so SSR / Strict Mode remounts do not tear the app. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      {marker ? (
        <>
          <FitRadius marker={marker} radiusMeters={radiusMeters} />
          <Circle
            center={[marker.lat, marker.lng]}
            radius={radiusMeters}
            pathOptions={{ className: "estimate-radius-area" }}
          />
          <CircleMarker
            center={[marker.lat, marker.lng]}
            radius={6}
            pathOptions={{ className: "estimate-radius-center" }}
          />
        </>
      ) : (
        <FlyToCenter center={center} zoom={13} />
      )}
    </MapContainer>
  );
}

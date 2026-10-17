"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { Layer } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { BUCKET_COLORS, type PriceBucket } from "@/lib/mapPriceBuckets";
import { isValidColombiaCoordinate } from "@/lib/nearbyAmenities";
import type { H3HeatCell } from "@/lib/h3Heatmap";
import { fixLeafletIcons } from "@/lib/leafletIcons";

function FitCityCells({
  cells,
  cityCenter,
  fitKey,
}: {
  cells: H3HeatCell[];
  cityCenter: [number, number];
  fitKey: string;
}) {
  const map = useMap();
  const lastFitKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;

    if (cells.length === 0) {
      map.setView(cityCenter, 12);
      return;
    }

    const points: L.LatLngTuple[] = cells.flatMap((cell) =>
      cell.boundary.filter(([lat, lng]) => isValidColombiaCoordinate(lat, lng)),
    );

    if (points.length === 0) {
      map.setView(cityCenter, 12);
      return;
    }

    const bounds = L.latLngBounds(points);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latSpan = ne.lat - sw.lat;
    const lngSpan = ne.lng - sw.lng;

    // Outlier coords can span all of South America — stay on the city instead.
    if (latSpan > 2.5 || lngSpan > 3.5) {
      map.setView(cityCenter, 12);
      return;
    }

    map.fitBounds(bounds.pad(0.08), { maxZoom: 14 });
  }, [cells, cityCenter, fitKey, map]);

  return null;
}

function FlyToSelectedCell({
  cell,
}: {
  cell: { h3Index: string; center: { lat: number; lng: number } } | null;
}) {
  const map = useMap();
  const lastIndex = useRef<string | null>(null);

  useEffect(() => {
    if (!cell) {
      lastIndex.current = null;
      return;
    }
    if (lastIndex.current === cell.h3Index) return;
    lastIndex.current = cell.h3Index;

    const { lat, lng } = cell.center;
    if (!isValidColombiaCoordinate(lat, lng)) return;

    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
  }, [cell, map]);

  return null;
}

type CellProps = {
  h3Index: string;
  count: number;
  medianPpm2: number;
  bucket: PriceBucket;
  topNeighborhood: string | null;
  centerLat: number;
  centerLng: number;
};

function toGeoJson(cells: H3HeatCell[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      properties: {
        h3Index: cell.h3Index,
        count: cell.count,
        medianPpm2: cell.medianPpm2,
        bucket: cell.bucket,
        topNeighborhood: cell.topNeighborhood,
        centerLat: cell.center.lat,
        centerLng: cell.center.lng,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          cell.boundary.map(([lat, lng]) => [lng, lat] as [number, number]),
        ],
      },
    })),
  };
}

export default function H3HeatmapMap({
  center,
  cells,
  fitKey,
  selectedCell,
  onCellSelect,
  tooltipForCell,
}: {
  center: [number, number];
  cells: H3HeatCell[];
  fitKey: string;
  selectedCell: { h3Index: string; center: { lat: number; lng: number } } | null;
  onCellSelect: (cell: CellProps) => void;
  formatPpm2?: (v: number) => string;
  tooltipForCell: (cell: CellProps) => string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fixLeafletIcons();
    setReady(true);
  }, []);

  const geojson = useMemo(() => toGeoJson(cells), [cells]);

  if (!ready) {
    return (
      <div
        className="z-0 h-[min(70vh,640px)] w-full rounded-2xl border border-slate-300 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-800/50"
        aria-hidden
      />
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="z-0 h-[min(70vh,640px)] w-full rounded-2xl border border-slate-300 dark:border-slate-600"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitCityCells cells={cells} cityCenter={center} fitKey={fitKey} />
      <FlyToSelectedCell cell={selectedCell} />
      <GeoJSON
        key={`${cells.length}-${cells[0]?.h3Index ?? "empty"}`}
        data={geojson}
        style={(feature) => {
          const bucket = (feature?.properties?.bucket ?? 1) as PriceBucket;
          const colors = BUCKET_COLORS[bucket] ?? BUCKET_COLORS[1];
          return {
            fillColor: colors.fill,
            color: colors.stroke,
            weight: 1.2,
            fillOpacity: 0.58,
          };
        }}
        onEachFeature={(feature, layer: Layer) => {
          const props = feature.properties as CellProps;
          layer.bindTooltip(tooltipForCell(props), { sticky: true });
          layer.on("click", () => onCellSelect(props));
        }}
      />
    </MapContainer>
  );
}

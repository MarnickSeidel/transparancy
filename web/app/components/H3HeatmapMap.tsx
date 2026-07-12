"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { GeoJSON as GeoJSONType, Layer } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { BUCKET_COLORS, type PriceBucket } from "@/lib/mapPriceBuckets";
import type { H3HeatCell } from "@/lib/h3Heatmap";

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

function FitBounds({ cells }: { cells: H3HeatCell[] }) {
  const map = useMap();
  useEffect(() => {
    if (cells.length === 0) return;
    const bounds = L.latLngBounds(
      cells.flatMap((cell) => cell.boundary.map(([lat, lng]) => [lat, lng])),
    );
    map.fitBounds(bounds.pad(0.08));
  }, [cells, map]);
  return null;
}

type CellProps = {
  h3Index: string;
  count: number;
  medianPpm2: number;
  bucket: PriceBucket;
  topNeighborhood: string | null;
};

function toGeoJson(cells: H3HeatCell[]): GeoJSONType.FeatureCollection {
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
  onCellSelect,
  tooltipForCell,
}: {
  center: [number, number];
  cells: H3HeatCell[];
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
      <FitBounds cells={cells} />
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

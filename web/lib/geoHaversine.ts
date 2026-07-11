import { Prisma } from "@prisma/client";

/** Great-circle distance between two points in meters. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Great-circle distance from point (lat,lng) to row l.latitude/l.longitude, meters. */
export function haversineWithinMetersSql(
  lat: number,
  lng: number,
  radiusM: number,
): Prisma.Sql {
  return Prisma.sql`(
    6371000.0 * acos(
      GREATEST(-1::float8, LEAST(1::float8,
        cos(radians(${lat})) * cos(radians(l.latitude)) * cos(radians(l.longitude) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(l.latitude))
      ))
    )
  ) <= ${radiusM}`;
}

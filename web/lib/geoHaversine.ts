import { Prisma } from "@prisma/client";

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

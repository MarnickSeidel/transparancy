/** Approximate map centers for estimate UI (WGS84). */
export const CITY_MAP_CENTER: Record<string, [number, number]> = {
  Pereira: [4.8133, -75.6961],
  Medellin: [6.2442, -75.5812],
  Bogota: [4.711, -74.0721],
  Cali: [3.4516, -76.532],
  Manizales: [5.07, -75.5138],
};

export function mapCenterForCity(city: string): [number, number] {
  return CITY_MAP_CENTER[city] ?? [4.65, -74.05];
}

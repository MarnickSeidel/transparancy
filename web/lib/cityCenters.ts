/** Approximate map centers for estimate UI (WGS84). */
export const CITY_MAP_CENTER: Record<string, [number, number]> = {
  Pereira: [4.8133, -75.6961],
  Medellin: [6.2442, -75.5812],
  Bogota: [4.711, -74.0721],
  Cali: [3.4516, -76.532],
  Manizales: [5.07, -75.5138],
  Barranquilla: [10.9685, -74.7813],
  Cartagena: [10.391, -75.4794],
  Bucaramanga: [7.1193, -73.1227],
  "Santa Marta": [11.2408, -74.199],
  Bello: [6.3373, -75.558],
  Ibague: [4.4389, -75.2322],
  Cucuta: [7.8939, -72.5078],
  Villavicencio: [4.142, -73.6268],
  Soacha: [4.5872, -74.2215],
  Soledad: [10.9182, -74.7647],
};

export function mapCenterForCity(city: string): [number, number] {
  return CITY_MAP_CENTER[city] ?? [4.65, -74.05];
}

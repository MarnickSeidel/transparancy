/**
 * Read-only: lists barrio display names that map to more than one dossier bucket per city,
 * plus buckets whose median price/m² is an outlier for the city. Use the output to decide
 * merges in the scraper's neighborhood resolver — this script changes nothing.
 *
 *   npx tsx scripts/audit-zone-duplicates.ts [City]
 */
import { PrismaClient } from "@prisma/client";

import { normalizeNeighborhoodKey } from "../lib/neighborhoods";
import { ZONE_DIRECTORY_OUTLIER_RATIO } from "../lib/zones";

const prisma = new PrismaClient();

type Row = {
  city: string;
  bucket_key: string;
  display_name: string | null;
  data_point_count: bigint;
  median_ppm2: number | null;
};

async function main() {
  const cityFilter = process.argv[2]?.trim() || null;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT city, bucket_key, display_name, data_point_count, median_ppm2
    FROM zone_list_aggregates
    WHERE data_point_count >= 20
    ORDER BY city, display_name, data_point_count DESC
  `;

  const byCity = new Map<string, Row[]>();
  for (const row of rows) {
    if (cityFilter && row.city !== cityFilter) continue;
    const list = byCity.get(row.city) ?? [];
    list.push(row);
    byCity.set(row.city, list);
  }

  for (const [city, list] of Array.from(byCity.entries())) {
    const medians = list
      .map((r) => r.median_ppm2)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    const baseline = medians.length ? medians[Math.floor(medians.length / 2)] : null;

    const groups = new Map<string, Row[]>();
    for (const row of list) {
      const key = normalizeNeighborhoodKey(row.display_name ?? "") || row.bucket_key;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    const duplicates = Array.from(groups.values()).filter((g) => g.length > 1);
    const outliers = baseline
      ? list.filter(
          (r) =>
            r.median_ppm2 != null &&
            (r.median_ppm2 > baseline * ZONE_DIRECTORY_OUTLIER_RATIO ||
              r.median_ppm2 < baseline / ZONE_DIRECTORY_OUTLIER_RATIO),
        )
      : [];
    const cityNamed = list.filter(
      (r) => normalizeNeighborhoodKey(r.display_name ?? "") === normalizeNeighborhoodKey(city),
    );

    if (!duplicates.length && !outliers.length && !cityNamed.length) continue;
    console.log(`\n== ${city} (median of medians: ${baseline?.toFixed(0) ?? "n/a"}) ==`);
    for (const group of duplicates) {
      console.log(`duplicate name "${group[0].display_name}":`);
      for (const r of group) {
        console.log(
          `  ${r.bucket_key}  n=${Number(r.data_point_count)}  median=${r.median_ppm2?.toFixed(0) ?? "—"}`,
        );
      }
    }
    for (const r of outliers) {
      console.log(
        `outlier ${r.bucket_key} "${r.display_name}"  n=${Number(r.data_point_count)}  median=${r.median_ppm2?.toFixed(0)}`,
      );
    }
    for (const r of cityNamed) {
      console.log(`named after city: ${r.bucket_key}  n=${Number(r.data_point_count)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

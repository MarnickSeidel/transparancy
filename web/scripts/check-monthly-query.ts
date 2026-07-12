import { queryMonthlyTrends } from "../lib/monthlyTrends";

async function main() {
  const result = await queryMonthlyTrends({ city: "Pereira", months: 6 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// One-time backfill: copy Item's deprecated single cost/currency/
// costCategory into the new ItemCost table (see schema.prisma).
//
// INSERT-only and idempotent — only touches items that have a legacy cost
// but zero ItemCost rows, so re-running after the new code deploys (to
// catch anything written through the old UI in between) is safe, and it
// can never duplicate or overwrite entries created through the new UI.
//
// Run with: npx tsx scripts/backfill-item-costs.ts [--dry-run]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const legacyItems = await prisma.item.findMany({
    where: { cost: { not: null }, costs: { none: {} } },
    select: { id: true, cost: true, currency: true, costCategory: true },
  });

  console.log(
    `${dryRun ? "[dry-run] " : ""}items with a legacy cost and no ItemCost rows: ${legacyItems.length}`
  );
  if (legacyItems.length === 0 || dryRun) return;

  // Same defaults BudgetSummary has always applied to missing values.
  const created = await prisma.itemCost.createMany({
    data: legacyItems.map((item) => ({
      itemId: item.id,
      label: null,
      amount: item.cost!,
      currency: item.currency ?? "TWD",
      category: item.costCategory ?? "OTHER",
      sortOrder: 0,
    })),
  });
  console.log(`created ${created.count} ItemCost rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

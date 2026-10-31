import { runBilling } from "../src/lib/billing/run";
import { prisma } from "../src/lib/db";
import { today } from "../src/lib/dates";

// Usage: npm run billing:run
async function main() {
  const run = await runBilling(today(), "cli");
  console.log(JSON.stringify(run, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

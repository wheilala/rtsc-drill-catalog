import { syncDrills } from "./notion/sync-drills.mjs";
import { syncSessionPlans } from "./notion/sync-session-plans.mjs";

async function main() {
  const startedAt = new Date();
  const drillResult = await syncDrills();
  const sessionPlanResult = await syncSessionPlans();

  console.log("");
  console.log("Sync summary");
  console.log("------------");
  console.log(`Synced drills: ${drillResult.synced}`);
  console.log(`Skipped drills: ${drillResult.skipped}`);
  console.log(`Fallback slugs: ${drillResult.fallbackSlugs}`);
  console.log(`Missing diagrams: ${drillResult.missingDiagrams}`);
  console.log(`Unsupported video links: ${drillResult.unsupportedVideoLinks}`);
  console.log(`Session plans synced: ${sessionPlanResult.synced}`);
  console.log(`Session plan warnings: ${sessionPlanResult.warnings}`);
  console.log(
    `Completed at: ${new Date().toISOString()} (${Math.round((Date.now() - startedAt.getTime()) / 1000)}s)`
  );
}

main().catch((error) => {
  console.error("Notion sync failed.");
  console.error(error);
  process.exitCode = 1;
});

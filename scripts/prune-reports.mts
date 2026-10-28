// Deletes old reports that nothing reads any more (see src/lib/retention.ts).
// Usage: npm run reports:prune
const { pruneReports } = await import("../src/lib/retention");
const { pg } = await import("../src/db");

try {
  const deleted = await pruneReports();
  console.log(deleted === null ? "Another prune is running." : `Deleted ${deleted} old reports.`);
} finally {
  await pg.end();
}

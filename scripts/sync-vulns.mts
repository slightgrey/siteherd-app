// Downloads the Wordfence vulnerability feed into the database.
// Usage: npm run vulns:sync              (needs WORDFENCE_API_KEY)
//        npm run vulns:sync -- --file feed.json   (a feed downloaded earlier)
import { readFileSync } from "node:fs";

const fileArg = process.argv.indexOf("--file");
const file = fileArg > -1 ? process.argv[fileArg + 1] : null;

// Imported after reading args: the db module needs DATABASE_URL from the env file.
const { syncFeed } = await import("../src/lib/vuln-feed");
const { pg } = await import("../src/db");

try {
  const count = await syncFeed(file ? { feed: JSON.parse(readFileSync(file, "utf8")) } : {});
  console.log(count === null ? "Another sync is running." : `Stored ${count} vulnerability records.`);
} finally {
  await pg.end();
}

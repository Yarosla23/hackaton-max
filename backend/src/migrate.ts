import { readEnvironment } from "./config.js";
import { migrateYdb } from "./ydb.js";

await migrateYdb(readEnvironment());
console.log("YDB schema is up to date");

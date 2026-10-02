// Entry point for `npm start` / `npm run dev`.
import { createApp } from "./app";
import { config } from "./config";
import { openDatabase } from "./db/connection";
import { log } from "./http/logger";

const db = openDatabase(config.dbPath);

const { n } = db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
if (n === 0) {
  log("warn", "database is empty; run `npm run seed` first", { dbPath: config.dbPath });
}

const app = createApp(db, { corsOrigin: config.corsOrigin });

app.listen(config.port, () => {
  log("info", "server listening", { url: `http://localhost:${config.port}`, events: n });
});

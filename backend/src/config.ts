import path from "node:path";
import { fileURLToPath } from "node:url";

// Folder that contains package.json, so the default DB path does not depend on
// which directory the command was started from.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? path.join(backendRoot, "audience.db"),
  // The frontend dev server's address; the browser blocks cross-origin calls otherwise.
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};

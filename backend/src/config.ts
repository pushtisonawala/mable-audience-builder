import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? path.join(backendRoot, "audience.db"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};

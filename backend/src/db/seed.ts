import { config } from "../config";
import { openDatabase } from "./connection";
import { seedDatabase } from "./seedData";

const db = openDatabase(config.dbPath);
const count = seedDatabase(db);
db.close();

console.log(`Seeded ${count} synthetic events into ${config.dbPath}`);

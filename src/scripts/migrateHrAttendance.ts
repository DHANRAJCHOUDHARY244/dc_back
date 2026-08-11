/**
 * One-time: create employee_profiles for CRM users + default shift/leave types/settings.
 * Run: npm run migrate:hr-attendance
 */
import "dotenv/config";
import mongoose from "mongoose";
import { migrateEmployeeProfiles } from "@services/hrAttendance.service";

async function main() {
	const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
	if (!uri) throw new Error("MONGO_URI not set");
	await mongoose.connect(uri);
	console.log("Connected. Migrating HR attendance profiles...");
	const result = await migrateEmployeeProfiles();
	console.log("Done:", result);
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

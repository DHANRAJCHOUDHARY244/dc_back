/**
 * Grant Super Admin / Admin / CEO / HR access to letter menus + user document list.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedDocumentLetterPermissions.ts
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function main() {
	const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
	if (!uri) throw new Error("MONGODB_URI missing");
	await mongoose.connect(uri);
	const { ensureDocumentLetterRoleRoutes } = await import("@services/permissionCatalogSync.service");
	const { seedDocumentLetterPermissions } = await import("src/data/dataInserter");
	await seedDocumentLetterPermissions();
	const result = await ensureDocumentLetterRoleRoutes();
	console.log("Document letter permissions synced:", result);
	await mongoose.disconnect();
}

main().catch(async (err) => {
	console.error(err);
	try {
		await mongoose.disconnect();
	} catch {
		/* ignore */
	}
	process.exit(1);
});

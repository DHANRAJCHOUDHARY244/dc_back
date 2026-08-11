/**
 * Seed default Training & Learning Hub categories.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedTrainingCategories.ts
 */
import "dotenv/config";
import mongoose from "mongoose";

const ROOT_CATEGORIES = [
	{ name: "Sales", slug: "sales", sort_order: 1 },
	{ name: "Operations", slug: "operations", sort_order: 2 },
	{ name: "Finance", slug: "finance", sort_order: 3 },
	{ name: "CRM", slug: "crm", sort_order: 4 },
	{ name: "HR & Compliance", slug: "hr-compliance", sort_order: 5 },
	{ name: "Technical Support", slug: "technical-support", sort_order: 6 },
	{ name: "Installation", slug: "installation", sort_order: 7 },
	{ name: "Onboarding", slug: "onboarding", sort_order: 8 },
	{ name: "Soft Skills", slug: "soft-skills", sort_order: 9 },
	{ name: "Product Knowledge", slug: "product-knowledge", sort_order: 10 },
];

async function nextSeq(db: any, name: string) {
	const doc = await db.collection("counters").findOneAndUpdate(
		{ name },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "after" },
	);
	return doc.seq as number;
}

async function syncCounter(db: any, name: string, collection: string) {
	const agg = await db
		.collection(collection)
		.aggregate([{ $group: { _id: null, maxId: { $max: "$id" } } }])
		.toArray();
	const maxId = Number(agg[0]?.maxId || 0);
	await db.collection("counters").updateOne({ name }, { $set: { seq: maxId } }, { upsert: true });
	return maxId;
}

async function main() {
	const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
	if (!uri) throw new Error("MONGODB_URI not set");
	await mongoose.connect(uri);
	const db = mongoose.connection.db!;
	const now = new Date();

	await syncCounter(db, "training_categories", "training_categories");

	let created = 0;
	for (const cat of ROOT_CATEGORIES) {
		const existing = await db.collection("training_categories").findOne({
			slug: cat.slug,
			deleted_at: null,
		});
		if (existing) continue;
		const id = await nextSeq(db, "training_categories");
		await db.collection("training_categories").insertOne({
			id,
			name: cat.name,
			slug: cat.slug,
			parent_id: null,
			description: "",
			sort_order: cat.sort_order,
			is_active: true,
			created_at: now,
			updated_at: now,
			deleted_at: null,
		});
		created += 1;
	}

	// Ensure settings exist
	await syncCounter(db, "training_settings", "training_settings");
	const settings = await db.collection("training_settings").findOne({});
	if (!settings) {
		const id = await nextSeq(db, "training_settings");
		await db.collection("training_settings").insertOne({
			id,
			video_complete_percent: 80,
			pdf_dwell_seconds: 30,
			reminder_days_before_deadline: 3,
			created_at: now,
			updated_at: now,
		});
	}

	console.log(JSON.stringify({ ok: true, categories_created: created }, null, 2));
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/**
 * Add HR Onboarding menu permission if missing (safe to re-run).
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedHrOnboardingPermission.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Roles } from "src/data/dataInserter";

async function nextSeq(db: any, name: string) {
	const doc = await db.collection("counters").findOneAndUpdate(
		{ name },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "after" },
	);
	return doc.seq as number;
}

async function main() {
	const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
	if (!uri) throw new Error("MONGODB_URI not set");
	await mongoose.connect(uri);
	const db = mongoose.connection.db!;
	const now = new Date();

	const parent = await db.collection("permissions").findOne({
		$or: [{ route: "hr" }, { name: "HR & Employees" }],
		parentId: null,
	});
	if (!parent) throw new Error("HR parent permission not found — run seedHrPermissionsFromSeq first");

	const existing = await db.collection("permissions").findOne({
		$or: [
			{ route: "onboarding", parentId: parent.id },
			{ route: "hr/onboarding", parentId: parent.id },
		],
	});
	if (existing) {
		console.log(JSON.stringify({ ok: true, skipped: true, permission_id: existing.id }, null, 2));
		await mongoose.disconnect();
		return;
	}

	const permissionId = await nextSeq(db, "permissions");
	const doc = {
		id: permissionId,
		name: "Onboarding",
		parentId: parent.id,
		label: "sys.menu.hr.onboarding",
		icon: "",
		type: 1,
		route: "onboarding",
		order: null,
		children: [],
		component: "/hr/onboarding/OnboardingPage.tsx",
		hide: false,
		status: 1,
		created_at: now,
		updated_at: now,
		deleted_at: null,
	};
	await db.collection("permissions").insertOne(doc);

	const roles = await db.collection("roles").find({ deleted_at: null }).toArray();
	const hrOnly = new Set([Roles.SUPER_ADMIN, Roles.HR_EXECUTIVE]);
	let inserted = 0;

	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const isHr = hrOnly.has(role.name);
		const id = await nextSeq(db, "user_permissions");
		await db.collection("user_permissions").insertOne({
			id,
			role_id: role.id,
			user_id: null,
			permission_id: permissionId,
			enable: isHr,
			create: isHr,
			can_update: isHr,
			delete: isHr,
			is_user_specific: false,
			created_at: now,
			updated_at: now,
			deleted_at: null,
		});
		inserted += 1;
	}

	console.log(JSON.stringify({ ok: true, permission_id: permissionId, user_permissions_inserted: inserted }, null, 2));
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

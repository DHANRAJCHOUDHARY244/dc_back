/**
 * Ensure HR Onboarding menu exists and is enabled for SUPER_ADMIN / ADMIN / CEO / HR_EXECUTIVE.
 * Safe to re-run.
 *
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
		deleted_at: null,
	});
	if (!parent) throw new Error("HR parent permission not found");

	let existing = await db.collection("permissions").findOne({
		$or: [
			{ component: "/hr/onboarding/OnboardingPage.tsx" },
			{ route: "onboarding", parentId: parent.id },
			{ route: "hr/onboarding", parentId: parent.id },
		],
		deleted_at: null,
	});

	let permissionId: number;
	if (existing) {
		permissionId = existing.id;
		await db.collection("permissions").updateOne(
			{ id: permissionId },
			{
				$set: {
					name: "Onboarding",
					parentId: parent.id,
					label: "sys.menu.hr.onboarding",
					type: 1,
					route: "onboarding",
					component: "/hr/onboarding/OnboardingPage.tsx",
					hide: false,
					status: 1,
					updated_at: now,
					deleted_at: null,
				},
			},
		);
	} else {
		// Prefer free catalog id 215; otherwise allocate from counter
		const preferred = 215;
		const taken = await db.collection("permissions").findOne({ id: preferred });
		permissionId = taken ? await nextSeq(db, "permissions") : preferred;
		if (!taken) {
			const counter = await db.collection("counters").findOne({ name: "permissions" });
			if ((counter?.seq || 0) < preferred) {
				await db.collection("counters").updateOne(
					{ name: "permissions" },
					{ $set: { seq: preferred } },
					{ upsert: true },
				);
			}
		}
		await db.collection("permissions").insertOne({
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
		});
	}

	const allowed = new Set([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO, Roles.HR_EXECUTIVE]);
	const roles = await db.collection("roles").find({ deleted_at: null }).toArray();
	let created = 0;
	let updated = 0;

	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const shouldEnable = allowed.has(role.name);
		const existingUp = await db.collection("user_permissions").findOne({
			role_id: role.id,
			permission_id: permissionId,
		});

		if (existingUp) {
			if (shouldEnable && (!existingUp.enable || existingUp.deleted_at)) {
				await db.collection("user_permissions").updateOne(
					{ id: existingUp.id },
					{
						$set: {
							enable: true,
							create: true,
							can_update: true,
							delete: role.name === Roles.SUPER_ADMIN,
							deleted_at: null,
							updated_at: now,
						},
					},
				);
				updated += 1;
			} else if (shouldEnable) {
				await db.collection("user_permissions").updateOne(
					{ id: existingUp.id },
					{
						$set: {
							enable: true,
							create: true,
							can_update: true,
							updated_at: now,
							deleted_at: null,
						},
					},
				);
				updated += 1;
			}
			continue;
		}

		const id = await nextSeq(db, "user_permissions");
		await db.collection("user_permissions").insertOne({
			id,
			role_id: role.id,
			user_id: null,
			permission_id: permissionId,
			enable: shouldEnable,
			create: shouldEnable,
			can_update: shouldEnable,
			delete: role.name === Roles.SUPER_ADMIN,
			is_user_specific: false,
			created_at: now,
			updated_at: now,
			deleted_at: null,
		});
		created += 1;
	}

	console.log(
		JSON.stringify(
			{
				ok: true,
				permission_id: permissionId,
				parent_id: parent.id,
				user_permissions_created: created,
				user_permissions_updated: updated,
				enabled_for: [...allowed],
			},
			null,
			2,
		),
	);
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

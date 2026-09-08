/**
 * Repair HR Onboarding menu visibility:
 * - Prefer original permission id 202 (restore if soft-deleted)
 * - Soft-delete duplicate id 215 to avoid double entries
 * - Ensure SUPER_ADMIN / ADMIN / CEO / HR_EXECUTIVE grants are enabled
 * - Align route to hr/onboarding (same pattern as other HR pages)
 * - Invalidate permission tree cache so menu refreshes
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/fixHrOnboardingMenu.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Roles } from "src/data/dataInserter";
import { invalidatePermissionCache } from "@services/permissionCache.service";
import { notifyRolePermissionChange } from "@services/permissionNotify.service";

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
		route: "hr",
		parentId: null,
		deleted_at: null,
	});
	if (!parent) throw new Error("HR parent not found");

	const allowed = new Set([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO, Roles.HR_EXECUTIVE]);

	// Collect all onboarding rows (active + soft-deleted)
	const rows = await db
		.collection("permissions")
		.find({
			$or: [
				{ component: "/hr/onboarding/OnboardingPage.tsx" },
				{ name: "Onboarding", parentId: parent.id },
				{ route: "onboarding", parentId: parent.id },
				{ route: "hr/onboarding", parentId: parent.id },
			],
		})
		.toArray();

	// Prefer lowest historic id (202), else any existing, else create 215
	rows.sort((a: any, b: any) => Number(a.id) - Number(b.id));
	let keep: any = rows[0];
	if (!keep) {
		const preferred = 215;
		const taken = await db.collection("permissions").findOne({ id: preferred });
		const id = taken ? await nextSeq(db, "permissions") : preferred;
		await db.collection("permissions").insertOne({
			id,
			name: "Onboarding",
			parentId: parent.id,
			label: "sys.menu.hr.onboarding",
			icon: "",
			type: 1,
			route: "hr/onboarding",
			order: 0,
			children: [],
			component: "/hr/onboarding/OnboardingPage.tsx",
			hide: false,
			status: 1,
			created_at: now,
			updated_at: now,
			deleted_at: null,
		});
		keep = await db.collection("permissions").findOne({ id });
	}

	const keepId = keep.id;

	await db.collection("permissions").updateOne(
		{ id: keepId },
		{
			$set: {
				name: "Onboarding",
				parentId: parent.id,
				label: "sys.menu.hr.onboarding",
				type: 1,
				route: "hr/onboarding",
				component: "/hr/onboarding/OnboardingPage.tsx",
				hide: false,
				status: 1,
				order: 0,
				updated_at: now,
				deleted_at: null,
			},
		},
	);

	// Soft-delete duplicates
	const dupIds = rows.map((r: any) => r.id).filter((id: number) => id !== keepId);
	if (dupIds.length) {
		await db.collection("permissions").updateMany(
			{ id: { $in: dupIds } },
			{ $set: { deleted_at: now, updated_at: now } },
		);
		await db.collection("user_permissions").updateMany(
			{ permission_id: { $in: dupIds } },
			{ $set: { deleted_at: now, updated_at: now, enable: false } },
		);
	}

	const roles = await db.collection("roles").find({ deleted_at: null }).toArray();
	let created = 0;
	let updated = 0;

	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const shouldEnable = allowed.has(role.name);
		const existingUp = await db.collection("user_permissions").findOne({
			role_id: role.id,
			permission_id: keepId,
		});

		if (existingUp) {
			await db.collection("user_permissions").updateOne(
				{ id: existingUp.id },
				{
					$set: {
						enable: shouldEnable,
						create: shouldEnable,
						can_update: shouldEnable,
						delete: role.name === Roles.SUPER_ADMIN,
						deleted_at: null,
						updated_at: now,
					},
				},
			);
			updated += 1;
		} else {
			const id = await nextSeq(db, "user_permissions");
			await db.collection("user_permissions").insertOne({
				id,
				role_id: role.id,
				user_id: null,
				permission_id: keepId,
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

		invalidatePermissionCache(role.id);
		try {
			notifyRolePermissionChange(role.id);
		} catch {
			/* socket may be offline in script */
		}
	}

	// Full cache wipe for any role trees
	invalidatePermissionCache();

	console.log(
		JSON.stringify(
			{
				ok: true,
				permission_id: keepId,
				parent_id: parent.id,
				route: "hr/onboarding",
				duplicates_soft_deleted: dupIds,
				grants_created: created,
				grants_updated: updated,
				enabled_for: [...allowed],
				next: "Log out and log back in (or hard refresh) so the menu reloads",
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

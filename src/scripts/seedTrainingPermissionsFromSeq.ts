/**
 * Seed Training & Learning Hub permissions (IDs from sequence after HR 140).
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedTrainingPermissionsFromSeq.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Roles } from "src/data/dataInserter";

const TRAINING_CHILDREN = [
	{
		name: "Training Dashboard",
		route: "training/dashboard",
		label: "sys.menu.training.dashboard",
		component: "/training/TrainingDashboardPage.tsx",
	},
	{
		name: "My Training",
		route: "training/my",
		label: "sys.menu.training.my",
		component: "/training/MyTrainingPage.tsx",
	},
	{
		name: "Library",
		route: "training/library",
		label: "sys.menu.training.library",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Mandatory Training",
		route: "training/mandatory",
		label: "sys.menu.training.mandatory",
		component: "/training/TrainingMandatoryPage.tsx",
	},
	{
		name: "Role-Based Training",
		route: "training/role-based",
		label: "sys.menu.training.role_based",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Progress",
		route: "training/progress",
		label: "sys.menu.training.progress",
		component: "/training/TrainingProgressPage.tsx",
	},
	{
		name: "Sales Training",
		route: "training/sales",
		label: "sys.menu.training.sales",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Operations Training",
		route: "training/operations",
		label: "sys.menu.training.operations",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Finance Training",
		route: "training/finance",
		label: "sys.menu.training.finance",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "CRM Training",
		route: "training/crm",
		label: "sys.menu.training.crm",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Videos",
		route: "training/videos",
		label: "sys.menu.training.videos",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "PDFs",
		route: "training/pdfs",
		label: "sys.menu.training.pdfs",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Images",
		route: "training/images",
		label: "sys.menu.training.images",
		component: "/training/TrainingLibraryPage.tsx",
	},
	{
		name: "Training Settings",
		route: "training/settings",
		label: "sys.menu.training.settings",
		component: "/training/TrainingSettingsPage.tsx",
	},
];

async function syncCounter(db: any, name: string, collection: string) {
	const agg = await db
		.collection(collection)
		.aggregate([{ $group: { _id: null, maxId: { $max: "$id" } } }])
		.toArray();
	const maxId = Number(agg[0]?.maxId || 0);
	await db.collection("counters").updateOne({ name }, { $set: { seq: maxId } }, { upsert: true });
	console.log(`Synced counter "${name}" => ${maxId}`);
	return maxId;
}

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

	const existing = await db
		.collection("permissions")
		.find({ $or: [{ route: { $regex: "^training" } }, { name: "Training & Learning Hub" }] })
		.toArray();
	if (existing.length) {
		const ids = existing.map((p: any) => p.id);
		await db.collection("user_permissions").deleteMany({ permission_id: { $in: ids } });
		await db.collection("permissions").deleteMany({ id: { $in: ids } });
		console.log(`Cleared existing Training perms ids=${ids.join(",")}`);
	}

	await syncCounter(db, "permissions", "permissions");
	await syncCounter(db, "user_permissions", "user_permissions");

	const parentId = await nextSeq(db, "permissions");
	const parent = {
		id: parentId,
		name: "Training & Learning Hub",
		parentId: null,
		label: "sys.menu.training.index",
		icon: "mdi:school-outline",
		type: 0,
		route: "training",
		order: 5,
		children: [],
		component: null,
		hide: false,
		status: 1,
		created_at: now,
		updated_at: now,
		deleted_at: null,
	};
	await db.collection("permissions").insertOne(parent);

	const created: any[] = [parent];
	for (const child of TRAINING_CHILDREN) {
		const id = await nextSeq(db, "permissions");
		const doc = {
			id,
			name: child.name,
			parentId,
			label: child.label,
			icon: "",
			type: 1,
			route: child.route,
			order: null,
			children: [],
			component: child.component,
			hide: false,
			status: 1,
			created_at: now,
			updated_at: now,
			deleted_at: null,
		};
		await db.collection("permissions").insertOne(doc);
		created.push(doc);
	}

	const permissionIds = created.map((p) => p.id);
	const roles = await db.collection("roles").find({ deleted_at: null }).toArray();

	const fullAccess = new Set([
		Roles.SUPER_ADMIN,
		Roles.CEO,
		Roles.ADMIN,
		Roles.HR_EXECUTIVE,
		Roles.MANAGER,
		Roles.OPERATIONS_MANAGER,
	]);
	const staffAccess = new Set([
		...fullAccess,
		Roles.SALES_PERSON,
		Roles.SENIOR_SALES_EXECUTIVE,
		Roles.SALES_EXECUTIVE,
		Roles.INSTALLER,
		Roles.CUSTOMER_SUPPORT_EXECUTIVE,
		Roles.ACCOUNTS_MANAGER,
		Roles.TECHNICAL_SUPPORT,
		Roles.QA,
		Roles.DATA_ANALYST,
		Roles.WEBSITE_DEVELOPER,
		Roles.SEO_MANAGER,
		Roles.DIGITAL_MARKETING_EXECUTIVE,
		Roles.LEAD_GENERATION_EXECUTIVE,
		Roles.CONTENT_WRITER,
		Roles.SOCIAL_MEDIA_MANAGER,
		Roles.GRAPHIC_DESIGNER,
		Roles.BUSINESS_DEVELOPMENT_EXECUTIVE,
	]);

	const staffOnlyRoutes = new Set([
		"training/dashboard",
		"training/my",
		"training/library",
		"training/mandatory",
		"training/progress",
		"training/role-based",
		"training/sales",
		"training/operations",
		"training/finance",
		"training/crm",
		"training/videos",
		"training/pdfs",
		"training/images",
	]);

	let upInserted = 0;
	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const isFull = fullAccess.has(role.name);
		const isStaff = staffAccess.has(role.name) || isFull;
		for (const perm of created) {
			const isParent = perm.type === 0;
			const enable = isFull || (isStaff && (isParent || staffOnlyRoutes.has(perm.route)));
			const id = await nextSeq(db, "user_permissions");
			await db.collection("user_permissions").insertOne({
				id,
				role_id: role.id,
				user_id: null,
				permission_id: perm.id,
				enable,
				create: isFull,
				can_update: isFull,
				delete: role.name === Roles.SUPER_ADMIN || role.name === Roles.ADMIN || role.name === Roles.HR_EXECUTIVE,
				is_user_specific: false,
				created_at: now,
				updated_at: now,
				deleted_at: null,
			});
			upInserted += 1;
		}
	}

	const counter = await db.collection("counters").findOne({ name: "permissions" });
	console.log(
		JSON.stringify(
			{
				ok: true,
				permissions_counter_seq: counter?.seq,
				training_permissions: created.map((p) => ({
					id: p.id,
					name: p.name,
					parentId: p.parentId,
					route: p.route,
					component: p.component || null,
					type: p.type,
				})),
				user_permissions_inserted: upInserted,
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

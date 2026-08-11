/**
 * Seed Confidential Feedback permissions (after Training 141–155).
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedFeedbackPermissionsFromSeq.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Roles } from "src/data/dataInserter";

const FEEDBACK_CHILDREN = [
	{
		name: "Feedback Home",
		route: "feedback/home",
		label: "sys.menu.feedback.home",
		component: "/feedback/FeedbackLandingPage.tsx",
		staff: true,
	},
	{
		name: "Submit Complaint",
		route: "feedback/complaint",
		label: "sys.menu.feedback.complaint",
		component: "/feedback/ComplaintFormPage.tsx",
		staff: true,
	},
	{
		name: "Submit Suggestion",
		route: "feedback/suggestion",
		label: "sys.menu.feedback.suggestion",
		component: "/feedback/SuggestionFormPage.tsx",
		staff: true,
	},
	{
		name: "My Submissions",
		route: "feedback/my",
		label: "sys.menu.feedback.my",
		component: "/feedback/MySubmissionsPage.tsx",
		staff: true,
	},
	{
		name: "Admin Dashboard",
		route: "feedback/admin",
		label: "sys.menu.feedback.admin_dashboard",
		component: "/feedback/AdminDashboardPage.tsx",
		staff: false,
	},
	{
		name: "All Cases",
		route: "feedback/admin/cases",
		label: "sys.menu.feedback.admin_cases",
		component: "/feedback/AdminCasesPage.tsx",
		staff: false,
	},
	{
		name: "Investigation",
		route: "feedback/admin/investigation",
		label: "sys.menu.feedback.investigation",
		component: "/feedback/AdminCasesPage.tsx",
		staff: false,
	},
	{
		name: "Action Required",
		route: "feedback/admin/action-required",
		label: "sys.menu.feedback.action_required",
		component: "/feedback/AdminCasesPage.tsx",
		staff: false,
	},
	{
		name: "Resolved Cases",
		route: "feedback/admin/resolved",
		label: "sys.menu.feedback.resolved",
		component: "/feedback/AdminCasesPage.tsx",
		staff: false,
	},
	{
		name: "Anonymous Feedback",
		route: "feedback/admin/anonymous",
		label: "sys.menu.feedback.anonymous",
		component: "/feedback/AdminCasesPage.tsx",
		staff: false,
	},
	{
		name: "Case Detail",
		route: "feedback/cases/:id",
		label: "sys.menu.feedback.case_detail",
		component: "/feedback/CaseDetailPage.tsx",
		staff: true,
		hide: true,
	},
	{
		name: "Feedback Audit Logs",
		route: "feedback/admin/audit",
		label: "sys.menu.feedback.audit",
		component: "/feedback/FeedbackAuditPage.tsx",
		staff: false,
	},
	{
		name: "Feedback Settings",
		route: "feedback/admin/settings",
		label: "sys.menu.feedback.settings",
		component: "/feedback/FeedbackSettingsPage.tsx",
		staff: false,
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
		.find({ $or: [{ route: { $regex: "^feedback" } }, { name: "Confidential Feedback" }] })
		.toArray();
	if (existing.length) {
		const ids = existing.map((p: any) => p.id);
		await db.collection("user_permissions").deleteMany({ permission_id: { $in: ids } });
		await db.collection("permissions").deleteMany({ id: { $in: ids } });
		console.log(`Cleared existing Feedback perms ids=${ids.join(",")}`);
	}

	await syncCounter(db, "permissions", "permissions");
	await syncCounter(db, "user_permissions", "user_permissions");

	const parentId = await nextSeq(db, "permissions");
	const parent = {
		id: parentId,
		name: "Confidential Feedback",
		parentId: null,
		label: "sys.menu.feedback.index",
		icon: "mdi:shield-lock-outline",
		type: 0,
		route: "feedback",
		order: 6,
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
	for (const child of FEEDBACK_CHILDREN) {
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
			hide: !!(child as any).hide,
			status: 1,
			created_at: now,
			updated_at: now,
			deleted_at: null,
			_staff: child.staff,
		};
		const { _staff, ...toInsert } = doc as any;
		await db.collection("permissions").insertOne(toInsert);
		created.push({ ...toInsert, _staff: child.staff });
	}

	const roles = await db.collection("roles").find({ deleted_at: null }).toArray();
	const adminAccess = new Set([
		Roles.SUPER_ADMIN,
		Roles.CEO,
		Roles.ADMIN,
		Roles.HR_EXECUTIVE,
	]);
	const staffAccess = new Set([
		...adminAccess,
		Roles.MANAGER,
		Roles.OPERATIONS_MANAGER,
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

	let upInserted = 0;
	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const isAdmin = adminAccess.has(role.name);
		const isStaff = staffAccess.has(role.name) || isAdmin;
		for (const perm of created) {
			const isParent = perm.type === 0;
			const staffOk = perm._staff !== false;
			const enable = isAdmin || (isStaff && (isParent || staffOk));
			const id = await nextSeq(db, "user_permissions");
			await db.collection("user_permissions").insertOne({
				id,
				role_id: role.id,
				user_id: null,
				permission_id: perm.id,
				enable,
				create: isAdmin || (isStaff && staffOk),
				can_update: isAdmin,
				delete: role.name === Roles.SUPER_ADMIN || role.name === Roles.ADMIN || role.name === Roles.HR_EXECUTIVE,
				is_user_specific: false,
				created_at: now,
				updated_at: now,
				deleted_at: null,
			});
			upInserted += 1;
		}
	}

	// Ensure settings doc
	await syncCounter(db, "feedback_settings", "feedback_settings");
	const settings = await db.collection("feedback_settings").findOne({});
	if (!settings) {
		const sid = await nextSeq(db, "feedback_settings");
		await db.collection("feedback_settings").insertOne({
			id: sid,
			confidentiality_notice:
				"Your submission is confidential. Only authorised Admin/HR/Management can access case details.",
			anonymous_notice:
				"Anonymous submissions hide your identity from case handlers. Unlock requires Super Admin and is audited.",
			admin_roles: ["SUPER_ADMIN", "ADMIN", "HR_EXECUTIVE", "CEO"],
			identity_unlock_roles: ["SUPER_ADMIN"],
			created_at: now,
			updated_at: now,
		});
	}

	const counter = await db.collection("counters").findOne({ name: "permissions" });
	console.log(
		JSON.stringify(
			{
				ok: true,
				permissions_counter_seq: counter?.seq,
				feedback_permissions: created.map((p) => ({
					id: p.id,
					name: p.name,
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

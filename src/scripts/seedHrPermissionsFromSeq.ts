/**
 * Fix HR permission IDs using real DB sequence (permissions.seq / user_permissions.seq).
 * - Removes wrongly seeded HR rows that stole low IDs (4–6)
 * - Syncs counters to max(id)
 * - Inserts full HR & Employees menu with next sequential ids
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedHrPermissionsFromSeq.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Roles } from "src/data/dataInserter";

const HR_CHILDREN = [
	{
		name: "Onboarding",
		route: "onboarding",
		label: "sys.menu.hr.onboarding",
		component: "/hr/onboarding/OnboardingPage.tsx",
	},
	{
		name: "Employees",
		route: "employees",
		label: "sys.menu.hr.employees",
		component: "/hr/employees/EmployeesPage.tsx",
	},
	{
		name: "Attendance",
		route: "attendance",
		label: "sys.menu.hr.attendance",
		component: "/hr/attendance/AttendancePage.tsx",
	},
	{
		name: "Leave Management",
		route: "leave",
		label: "sys.menu.hr.leave",
		component: "/hr/leave/LeavePage.tsx",
	},
	{
		name: "Attendance Corrections",
		route: "corrections",
		label: "sys.menu.hr.corrections",
		component: "/hr/corrections/CorrectionsPage.tsx",
	},
	{
		name: "Attendance Reports",
		route: "reports",
		label: "sys.menu.hr.reports",
		component: "/hr/reports/ReportsPage.tsx",
	},
	{
		name: "Attendance Analytics",
		route: "analytics",
		label: "sys.menu.hr.analytics",
		component: "/hr/analytics/AnalyticsPage.tsx",
	},
	{
		name: "Payroll",
		route: "payroll",
		label: "sys.menu.hr.payroll",
		component: "/hr/payroll/PayrollPage.tsx",
	},
	{
		name: "Salary Slips",
		route: "salary-slips",
		label: "sys.menu.hr.salary_slips",
		component: "/hr/salary-slips/SalarySlipsPage.tsx",
	},
	{
		name: "Holidays",
		route: "holidays",
		label: "sys.menu.hr.holidays",
		component: "/hr/holidays/HolidaysPage.tsx",
	},
	{
		name: "Shift Management",
		route: "shifts",
		label: "sys.menu.hr.shifts",
		component: "/hr/shifts/ShiftsPage.tsx",
	},
	{
		name: "Attendance Settings",
		route: "settings",
		label: "sys.menu.hr.settings",
		component: "/hr/settings/SettingsPage.tsx",
	},
	{
		name: "Audit Logs",
		route: "audit",
		label: "sys.menu.hr.audit",
		component: "/hr/audit/AuditLogsPage.tsx",
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

	// 1) Remove broken low-ID HR rows (counter was out of sync)
	const badHr = await db
		.collection("permissions")
		.find({
			$or: [{ route: { $regex: "^hr" } }, { name: "HR & Employees" }],
			id: { $lt: 100 },
		})
		.toArray();
	const badIds = badHr.map((p: any) => p.id);
	if (badIds.length) {
		const upDel = await db.collection("user_permissions").deleteMany({ permission_id: { $in: badIds } });
		const pDel = await db.collection("permissions").deleteMany({ id: { $in: badIds } });
		console.log(`Removed bad HR perms ids=${badIds.join(",")} permissions=${pDel.deletedCount} user_permissions=${upDel.deletedCount}`);
	}

	// Also remove any other hr routes if re-running (keep high ids clean)
	const existingHr = await db
		.collection("permissions")
		.find({ $or: [{ route: { $regex: "^hr" } }, { name: "HR & Employees" }] })
		.toArray();
	if (existingHr.length) {
		const ids = existingHr.map((p: any) => p.id);
		await db.collection("user_permissions").deleteMany({ permission_id: { $in: ids } });
		await db.collection("permissions").deleteMany({ id: { $in: ids } });
		console.log(`Cleared existing HR perms ids=${ids.join(",")}`);
	}

	// 2) Sync counters to real max
	await syncCounter(db, "permissions", "permissions");
	await syncCounter(db, "user_permissions", "user_permissions");

	// 3) Insert catalogue + children with sequential ids
	const parentId = await nextSeq(db, "permissions");
	const parent = {
		id: parentId,
		name: "HR & Employees",
		parentId: null,
		label: "sys.menu.hr.index",
		icon: "mdi:account-group-outline",
		type: 0,
		route: "hr",
		order: 4,
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
	for (const child of HR_CHILDREN) {
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
	const selfAccess = new Set([
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

	let upInserted = 0;
	const hrOnly = new Set([Roles.SUPER_ADMIN, Roles.HR_EXECUTIVE]);
	for (const role of roles as any[]) {
		if (role.name === Roles.CUSTOMER) continue;
		const isFull = fullAccess.has(role.name);
		const enabled = selfAccess.has(role.name) || isFull;
		const isHrOnly = hrOnly.has(role.name);
		for (const perm of created) {
			const isOnboarding = perm.route === "onboarding";
			const id = await nextSeq(db, "user_permissions");
			await db.collection("user_permissions").insertOne({
				id,
				role_id: role.id,
				user_id: null,
				permission_id: perm.id,
				enable: isOnboarding ? isHrOnly : enabled,
				create: isOnboarding ? isHrOnly : isFull,
				can_update: isOnboarding ? isHrOnly : isFull,
				delete:
					role.name === Roles.SUPER_ADMIN ||
					role.name === Roles.ADMIN ||
					role.name === Roles.HR_EXECUTIVE,
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
				hr_permissions: created.map((p) => ({
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

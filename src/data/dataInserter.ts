import { permissionRepository, roleRepository, userPermissionRepository } from "@repositories";
import { importAdvertisingData } from "src/helpers/advertisingDataInserter";
import { sendMarketingEmails } from "src/helpers/sendMarketingEmail";
import { seedProducts } from "./productSeeder";

export const Roles = {
  // ===== SYSTEM / OWNERSHIP =====
  SUPER_ADMIN: "SUPER_ADMIN",
  CEO: "CEO",

  // ===== MANAGEMENT =====
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  OPERATIONS_MANAGER: "OPERATIONS_MANAGER",
  HR_EXECUTIVE: "HR_EXECUTIVE",

  // ===== TECH =====
  WEBSITE_DEVELOPER: "WEBSITE_DEVELOPER",
  TECHNICAL_SUPPORT: "TECHNICAL_SUPPORT",
  QA: "QA",
  DATA_ANALYST: "DATA_ANALYST",

  // ===== MARKETING =====
  SEO_MANAGER: "SEO_MANAGER",
  DIGITAL_MARKETING_EXECUTIVE: "DIGITAL_MARKETING_EXECUTIVE",
  CONTENT_WRITER: "CONTENT_WRITER",
  SOCIAL_MEDIA_MANAGER: "SOCIAL_MEDIA_MANAGER",
  GRAPHIC_DESIGNER: "GRAPHIC_DESIGNER",
  LEAD_GENERATION_EXECUTIVE: "LEAD_GENERATION_EXECUTIVE",

  // ===== SALES =====
  SALES_PERSON: "SALES_PERSON",
  SENIOR_SALES_EXECUTIVE: "SENIOR_SALES_EXECUTIVE",
  SALES_EXECUTIVE: "SALES_EXECUTIVE",
  BUSINESS_DEVELOPMENT_EXECUTIVE: "BUSINESS_DEVELOPMENT_EXECUTIVE",

  // ===== OPERATIONS =====
  INSTALLER: "INSTALLER",
  CUSTOMER_SUPPORT_EXECUTIVE: "CUSTOMER_SUPPORT_EXECUTIVE",

  // ===== FINANCE =====
  ACCOUNTS_MANAGER: "ACCOUNTS_MANAGER",

  // ===== END USER =====
  CUSTOMER: "CUSTOMER",
};

export const rolesData = [
  {
    name: Roles.SUPER_ADMIN,
    label: "Super Admin",
    desc: "Super access of all things across the system.",
    order: 1,
  },
  {
    name: Roles.CEO,
    label: "Chief Executive Officer (CEO)",
    desc: "Overall strategic leadership and decision-making authority.",
    order: 2,
  },
  {
    name: Roles.ADMIN,
    label: "Administrator",
    desc: "Full access to system features, users, and settings.",
    order: 3,
  },
  {
    name: Roles.MANAGER,
    label: "Manager",
    desc: "Manages teams, workflows, and performance tracking.",
    order: 4,
  },
  {
    name: Roles.OPERATIONS_MANAGER,
    label: "Operations Manager",
    desc: "Oversees daily operations and service execution.",
    order: 5,
  },
  {
    name: Roles.HR_EXECUTIVE,
    label: "HR & Recruitment Executive",
    desc: "Handles hiring, onboarding, and employee management.",
    order: 6,
  },

  // ===== TECH =====
  {
    name: Roles.WEBSITE_DEVELOPER,
    label: "Website Developer",
    desc: "Develops and maintains web applications and systems.",
    order: 7,
  },
  {
    name: Roles.TECHNICAL_SUPPORT,
    label: "Technical Support",
    desc: "Provides technical assistance and issue resolution.",
    order: 8,
  },
  {
    name: Roles.QA,
    label: "Quality Analyst (QA)",
    desc: "Ensures product quality through testing and validation.",
    order: 9,
  },
  {
    name: Roles.DATA_ANALYST,
    label: "Data Analyst / MIS Executive",
    desc: "Analyzes data and generates business insights and reports.",
    order: 10,
  },

  // ===== MARKETING =====
  {
    name: Roles.SEO_MANAGER,
    label: "SEO Manager / SEO Executive",
    desc: "Optimizes website visibility and search rankings.",
    order: 11,
  },
  {
    name: Roles.DIGITAL_MARKETING_EXECUTIVE,
    label: "Digital Marketing Executive",
    desc: "Executes online marketing and advertising campaigns.",
    order: 12,
  },
  {
    name: Roles.LEAD_GENERATION_EXECUTIVE,
    label: "Lead Generation Executive",
    desc: "Generates and qualifies sales leads.",
    order: 13,
  },
  {
    name: Roles.CONTENT_WRITER,
    label: "Content Writer / Copywriter",
    desc: "Creates marketing and informational content.",
    order: 14,
  },
  {
    name: Roles.SOCIAL_MEDIA_MANAGER,
    label: "Social Media Manager",
    desc: "Manages brand presence across social platforms.",
    order: 15,
  },
  {
    name: Roles.GRAPHIC_DESIGNER,
    label: "Graphic Designer",
    desc: "Designs visual assets and branding materials.",
    order: 16,
  },

  // ===== SALES =====
  {
    name: Roles.SENIOR_SALES_EXECUTIVE,
    label: "Senior Sales Executive",
    desc: "Leads sales initiatives and handles key clients.",
    order: 17,
  },
  {
    name: Roles.SALES_EXECUTIVE,
    label: "Sales Executive",
    desc: "Handles sales, follow-ups, and customer conversion.",
    order: 18,
  },
  {
    name: Roles.BUSINESS_DEVELOPMENT_EXECUTIVE,
    label: "Business Development Executive",
    desc: "Expands partnerships and business opportunities.",
    order: 19,
  },

  // ===== OPERATIONS =====
  {
    name: Roles.INSTALLER,
    label: "Installer",
    desc: "Handles installation and field service operations.",
    order: 20,
  },
  {
    name: Roles.CUSTOMER_SUPPORT_EXECUTIVE,
    label: "Customer Support & Operations Executive",
    desc: "Manages customer queries and operational support.",
    order: 21,
  },

  // ===== FINANCE =====
  {
    name: Roles.ACCOUNTS_MANAGER,
    label: "Accounts Manager / Accountant",
    desc: "Manages billing, payments, and financial records.",
    order: 22,
  },

  // ===== END USER =====
  {
    name: Roles.CUSTOMER,
    label: "Customer",
    desc: "End user with access to personal dashboard and services.",
    order: 23,
  },
];


export const seedRoles = async () => {
  const roleNames = rolesData.map(r => r.name);

  const existingRoles = await roleRepository.find(
    { name: { $in: roleNames } },
    { select: "name", lean: true },
  );

  const existingNames = new Set(existingRoles.map((r: any) => r.name));

  const newRoles = rolesData.filter(
    role => !existingNames.has(role.name)
  );

  if (newRoles.length) {
    for (const role of newRoles) {
      await roleRepository.create(role);
    }
  }

  console.log("Inserted:", newRoles.map(r => r.name));
  console.log("Already exists:", [...existingNames]);

  await seedFinanceAccountsPermission();
  await seedAllInOnePermission();
  await seedHrAttendancePermissions();

  // await importAdvertisingData();
  // await sendMarketingEmails()
};

/** Idempotent: adds the Finance > Accounts menu permission for existing databases. */
export const seedFinanceAccountsPermission = async () => {
  try {
    const existing = await permissionRepository.findOne({ route: "finance/accounts" });
    if (existing) return;

    const parent = await permissionRepository.findOne({ route: "finance" });
    if (!parent) return;

    const permission = await permissionRepository.create({
      name: "Accounts",
      parentId: (parent as any).id,
      label: "sys.menu.finance.accounts",
      type: 1,
      route: "finance/accounts",
      component: "/finance/accounts/AccountsPage.tsx",
    });

    const roles = await roleRepository.find();
    await Promise.all(
      roles.map((role: any) =>
        userPermissionRepository.create({
          role_id: role.id,
          permission_id: (permission as any).id,
          enable: role.name === Roles.SUPER_ADMIN,
          create: role.name === Roles.SUPER_ADMIN,
          can_update: role.name === Roles.SUPER_ADMIN,
          delete: role.name === Roles.SUPER_ADMIN,
          is_user_specific: false,
        }),
      ),
    );
    console.log("Seeded Finance > Accounts permission");
  } catch (err) {
    console.error("seedFinanceAccountsPermission failed", err);
  }
};

/** Idempotent: adds Pre Approval + Grid Assessment catalogue + Jobs menu for existing databases. */
export const seedAllInOnePermission = async () => {
  try {
    // Rename legacy catalogue label if already seeded as "All in One"
    const legacy = await permissionRepository.findOne({ route: "all-in-one", name: "All in One" });
    if (legacy) {
      await permissionRepository.updateById((legacy as any).id, {
        $set: { name: "Pre Approval + Grid Assessment" },
      });
      console.log("Renamed All in One → Pre Approval + Grid Assessment");
    }

    const existing = await permissionRepository.findOne({ route: "all-in-one", parentId: null });
    if (existing) {
      if ((existing as any).name !== "Pre Approval + Grid Assessment") {
        await permissionRepository.updateById((existing as any).id, {
          $set: { name: "Pre Approval + Grid Assessment" },
        });
      }
      return;
    }

    const catalogue = await permissionRepository.create({
      name: "Pre Approval + Grid Assessment",
      label: "sys.menu.all_in_one.index",
      icon: "solar:widget-5-bold-duotone",
      type: 0,
      route: "all-in-one",
      order: 5,
    });
    const catId = (catalogue as any).id;

    const jobs = await permissionRepository.create({
      name: "Jobs",
      parentId: catId,
      label: "sys.menu.all_in_one.jobs",
      type: 1,
      route: "list",
      component: "/all-in-one/AllInOneJobsListPage.tsx",
    });
    const createNew = await permissionRepository.create({
      name: "New Job",
      parentId: catId,
      label: "sys.menu.all_in_one.job_new",
      type: 1,
      route: "job/new",
      component: "/all-in-one/AllInOneJobDetailPage.tsx",
      hide: true,
    });
    const detail = await permissionRepository.create({
      name: "Job Detail",
      parentId: catId,
      label: "sys.menu.all_in_one.job_detail",
      type: 1,
      route: "job/:id",
      component: "/all-in-one/AllInOneJobDetailPage.tsx",
      hide: true,
    });

    const roles = await roleRepository.find();
    const permissionIds = [(jobs as any).id, (createNew as any).id, (detail as any).id, catId];
    const staffRoles = new Set([
      Roles.SUPER_ADMIN,
      Roles.CEO,
      Roles.ADMIN,
      Roles.MANAGER,
      Roles.OPERATIONS_MANAGER,
      Roles.SALES_PERSON,
      Roles.SENIOR_SALES_EXECUTIVE,
      Roles.SALES_EXECUTIVE,
      Roles.INSTALLER,
      Roles.CUSTOMER_SUPPORT_EXECUTIVE,
      Roles.ACCOUNTS_MANAGER,
    ]);

    for (const role of roles as any[]) {
      const enabled = staffRoles.has(role.name) || role.name === Roles.SUPER_ADMIN;
      for (const permission_id of permissionIds) {
        await userPermissionRepository.create({
          role_id: role.id,
          permission_id,
          enable: enabled,
          create: enabled,
          can_update: enabled,
          delete: role.name === Roles.SUPER_ADMIN || role.name === Roles.ADMIN || role.name === Roles.MANAGER,
          is_user_specific: false,
        });
      }
    }
    console.log("Seeded Pre Approval + Grid Assessment permissions");
  } catch (err) {
    console.error("seedAllInOnePermission failed", err);
  }
};

/** Idempotent: HR & Employees menu + children + role grants (uses DB counter after sync to max id) */
export const seedHrAttendancePermissions = async () => {
  try {
    const existing = await permissionRepository.findOne({ route: "hr", parentId: null });
    if (existing) return;

    // Keep counter ahead of real max so new ids never collide with legacy catalogue rows
    const { Counter } = await import("@db/counter.model");
    const maxAgg: any[] = await permissionRepository.aggregate([
      { $group: { _id: null, maxId: { $max: "$id" } } },
    ]);
    const maxId = Number(maxAgg[0]?.maxId || 0);
    await Counter.collection.updateOne({ name: "permissions" }, { $set: { seq: maxId } }, { upsert: true });

    const upMax: any[] = await userPermissionRepository.aggregate([
      { $group: { _id: null, maxId: { $max: "$id" } } },
    ]);
    await Counter.collection.updateOne(
      { name: "user_permissions" },
      { $set: { seq: Number(upMax[0]?.maxId || 0) } },
      { upsert: true },
    );

    const catalogue = await permissionRepository.create({
      name: "HR & Employees",
      parentId: null,
      label: "sys.menu.hr.index",
      icon: "mdi:account-group-outline",
      type: 0,
      route: "hr",
      order: 4,
    });
    const catId = (catalogue as any).id;

    const children = [
      { name: "Employees", route: "hr/employees", label: "sys.menu.hr.employees", component: "/hr/employees/EmployeesPage.tsx" },
      { name: "Attendance", route: "hr/attendance", label: "sys.menu.hr.attendance", component: "/hr/attendance/AttendancePage.tsx" },
      { name: "Leave Management", route: "hr/leave", label: "sys.menu.hr.leave", component: "/hr/leave/LeavePage.tsx" },
      { name: "Attendance Corrections", route: "hr/corrections", label: "sys.menu.hr.corrections", component: "/hr/corrections/CorrectionsPage.tsx" },
      { name: "Attendance Reports", route: "hr/reports", label: "sys.menu.hr.reports", component: "/hr/reports/ReportsPage.tsx" },
      { name: "Attendance Analytics", route: "hr/analytics", label: "sys.menu.hr.analytics", component: "/hr/analytics/AnalyticsPage.tsx" },
      { name: "Payroll", route: "hr/payroll", label: "sys.menu.hr.payroll", component: "/hr/payroll/PayrollPage.tsx" },
      { name: "Salary Slips", route: "hr/salary-slips", label: "sys.menu.hr.salary_slips", component: "/hr/salary-slips/SalarySlipsPage.tsx" },
      { name: "Holidays", route: "hr/holidays", label: "sys.menu.hr.holidays", component: "/hr/holidays/HolidaysPage.tsx" },
      { name: "Shift Management", route: "hr/shifts", label: "sys.menu.hr.shifts", component: "/hr/shifts/ShiftsPage.tsx" },
      { name: "Attendance Settings", route: "hr/settings", label: "sys.menu.hr.settings", component: "/hr/settings/SettingsPage.tsx" },
      { name: "Audit Logs", route: "hr/audit", label: "sys.menu.hr.audit", component: "/hr/audit/AuditLogsPage.tsx" },
    ];

    const permissionIds = [catId];
    for (const c of children) {
      const p = await permissionRepository.create({
        name: c.name,
        parentId: catId,
        label: c.label,
        type: 1,
        route: c.route,
        component: c.component,
      });
      permissionIds.push((p as any).id);
    }

    const roles = await roleRepository.find();
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

    for (const role of roles as any[]) {
      if (role.name === Roles.CUSTOMER) continue;
      const isFull = fullAccess.has(role.name);
      const enabled = selfAccess.has(role.name) || isFull;
      for (const permission_id of permissionIds) {
        await userPermissionRepository.create({
          role_id: role.id,
          permission_id,
          enable: enabled,
          create: isFull,
          can_update: isFull,
          delete: role.name === Roles.SUPER_ADMIN || role.name === Roles.ADMIN || role.name === Roles.HR_EXECUTIVE,
          is_user_specific: false,
        });
      }
    }
    console.log("Seeded HR & Employees permissions with ids:", permissionIds);
  } catch (err) {
    console.error("seedHrAttendancePermissions failed", err);
  }
};


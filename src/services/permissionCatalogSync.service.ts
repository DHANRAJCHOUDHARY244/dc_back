import permissionCatalog from "../data/permissions";
import { Roles } from "../data/dataInserter";
import { permissionRepository, roleRepository, userPermissionRepository } from "@repositories";
import { invalidatePermissionCache } from "@services/permissionCache.service";
import { syncSequenceFromMax } from "@db/counter.model";

type CatalogNode = {
  id?: number;
  name: string;
  parentId?: number | null;
  label: string;
  icon?: string;
  type: number;
  route: string;
  order?: number | null;
  component?: string | null;
  hide?: boolean;
  status?: number | null;
  newFeature?: boolean | null;
  children?: CatalogNode[];
};

type FlatCatalogItem = CatalogNode & {
  catalogKey: string;
  parentCatalogKey: string | null;
};

function catalogKey(parentRoute: string | null, route: string, component?: string | null) {
  return `${parentRoute ?? "root"}::${route}::${component ?? ""}`;
}

function flattenCatalog(
  nodes: CatalogNode[],
  parentRoute: string | null = null,
  parentCatalogKey: string | null = null,
): FlatCatalogItem[] {
  const out: FlatCatalogItem[] = [];
  for (const node of nodes) {
    const key = catalogKey(parentRoute, node.route, node.component);
    out.push({
      ...node,
      catalogKey: key,
      parentCatalogKey,
    });
    if (node.children?.length) {
      out.push(...flattenCatalog(node.children, node.route, key));
    }
  }
  return out;
}

async function syncCounters() {
  const maxPerm: any[] = await permissionRepository.aggregateRaw([
    { $group: { _id: null, maxId: { $max: "$id" } } },
  ]);
  const maxUp: any[] = await userPermissionRepository.aggregateRaw([
    { $group: { _id: null, maxId: { $max: "$id" } } },
  ]);
  await syncSequenceFromMax("permissions", Number(maxPerm[0]?.maxId || 0));
  await syncSequenceFromMax("user_permissions", Number(maxUp[0]?.maxId || 0));
}

function dbMatchKey(parentRoute: string | null, perm: any) {
  return catalogKey(parentRoute, perm.route, perm.component);
}

async function buildDbMaps() {
  const all: any[] = await permissionRepository.collection.find({}).toArray();
  const byId = new Map<number, any>();
  const byKey = new Map<string, any>();
  for (const p of all) {
    byId.set(p.id, p);
  }
  for (const p of all) {
    const parent = p.parentId ? byId.get(p.parentId) : null;
    const parentRoute = parent?.route ?? null;
    byKey.set(dbMatchKey(parentRoute, p), p);
  }
  return { byId, byKey, all };
}

function installerJobsComponent(component?: string | null) {
  return !!component && component.includes("/installer-jobs/");
}

function isHrPermission(perm: FlatCatalogItem | { route?: string; component?: string | null }) {
  const route = String(perm.route || "");
  const component = String(perm.component || "");
  return route === "hr" || component.includes("/hr/") || route.startsWith("hr/");
}

function resolveRoleGrants(perm: FlatCatalogItem) {
  const isInstallerJobs =
    installerJobsComponent(perm.component) ||
    perm.route === "installer-jobs" ||
    String(perm.route || "").startsWith("installer-jobs");
  if (isInstallerJobs) {
    return {
      enableRoles: new Set([
        Roles.SUPER_ADMIN,
        Roles.CEO,
        Roles.ADMIN,
        Roles.MANAGER,
        Roles.OPERATIONS_MANAGER,
        Roles.INSTALLER,
      ]),
      fullCrudRoles: new Set([
        Roles.SUPER_ADMIN,
        Roles.ADMIN,
        Roles.CEO,
        Roles.MANAGER,
        Roles.OPERATIONS_MANAGER,
      ]),
    };
  }

  const isAssistantSettings =
    perm.route === "assistant-settings" ||
    String(perm.component || "").includes("/assistant-settings/");
  if (isAssistantSettings) {
    return {
      enableRoles: new Set([
        Roles.SUPER_ADMIN,
        Roles.CEO,
        Roles.ADMIN,
        Roles.MANAGER,
      ]),
      fullCrudRoles: new Set([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO, Roles.MANAGER]),
    };
  }

  if (isHrPermission(perm)) {
    const hrFull = new Set([
      Roles.SUPER_ADMIN,
      Roles.CEO,
      Roles.ADMIN,
      Roles.HR_EXECUTIVE,
      Roles.MANAGER,
      Roles.OPERATIONS_MANAGER,
    ]);
    const hrSelf = new Set([
      ...hrFull,
      Roles.SALES_PERSON,
      Roles.SALES_LEADER,
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
    const onboardingOnly = perm.route === "onboarding" || perm.route === "hr/onboarding";
    return {
      enableRoles: onboardingOnly
        ? new Set([Roles.SUPER_ADMIN, Roles.HR_EXECUTIVE])
        : hrSelf,
      fullCrudRoles: hrFull,
    };
  }

  return null;
}

async function ensureUserPermissions(permissionId: number, perm: FlatCatalogItem) {
  const grants = resolveRoleGrants(perm);
  if (!grants) return 0;

  const roles: any[] = await roleRepository.find({}, { lean: true });
  let created = 0;
  for (const role of roles) {
    if (role.name === Roles.CUSTOMER) continue;
    const exists = await userPermissionRepository.findOne({
      role_id: role.id,
      permission_id: permissionId,
    });
    if (exists) continue;

    const enabled = grants.enableRoles.has(role.name);
    const full = grants.fullCrudRoles.has(role.name);
    await userPermissionRepository.create({
      role_id: role.id,
      permission_id: permissionId,
      enable: enabled,
      create: full,
      can_update: full,
      delete: role.name === Roles.SUPER_ADMIN,
      is_user_specific: false,
      is_admin: role.name === Roles.SUPER_ADMIN,
    });
    created += 1;
  }
  return created;
}

export type PermissionCatalogSyncResult = {
  created: number;
  updated: number;
  unchanged: number;
  legacyRemoved: number;
  userPermissionsCreated: number;
  catalogKeys: string[];
};

/**
 * Sync permissions.ts catalogue with MongoDB:
 * - Syncs id counters from DB max
 * - Updates existing rows (matched by parent route + route + component)
 * - Inserts missing catalogue entries with next sequential id
 * - Grants role access for installer-job permissions
 */
async function removeLegacyInstallerJobPermissions() {
  const legacy: any[] = await permissionRepository.find(
    {
      $or: [
        { route: { $regex: "^\\.\\./installer-jobs" } },
        { route: "list", component: { $regex: "/installer-jobs/" } },
      ],
    },
    { lean: true },
  );
  if (!legacy.length) return 0;

  const ids = legacy.map((p) => p.id);
  await userPermissionRepository.deleteMany({ permission_id: { $in: ids } });
  await permissionRepository.deleteMany({ id: { $in: ids } });
  return ids.length;
}

async function findExistingPermission(
  item: FlatCatalogItem,
  parentDbId: number | null,
  byKey: Map<string, any>,
  byId: Map<number, any>,
) {
  const lookupKey = item.catalogKey;
  let existing = byKey.get(lookupKey);

  if (!existing && item.id) {
    existing = byId.get(item.id);
  }

  if (!existing && item.component) {
    existing = [...byKey.values()].find((p) => p.component === item.component);
  }

  if (!existing && parentDbId) {
    existing = [...byKey.values()].find(
      (p) =>
        p.route === item.route &&
        p.component === item.component &&
        Number(p.parentId) === Number(parentDbId),
    );
  }

  if (!existing && item.id) {
    existing = [...byKey.values()].find((p) => Number(p.id) === Number(item.id));
  }

  return existing;
}

async function restoreAndUpdatePermission(id: number, payload: Record<string, unknown>) {
  await permissionRepository.collection.updateOne(
    { id },
    { $set: { ...payload, deleted_at: null } },
  );
  return permissionRepository.findById(id, { lean: true });
}

async function createCatalogPermission(
  item: FlatCatalogItem,
  payload: Record<string, unknown>,
): Promise<any> {
  const data: Record<string, unknown> = { ...payload };
  if (item.id != null) data.id = item.id;

  try {
    return await permissionRepository.create(data);
  } catch (err: any) {
    if (err?.code !== 11000) throw err;

    await syncCounters();

    if (item.id != null) {
      const restored = await restoreAndUpdatePermission(item.id, payload);
      if (restored) return restored;
    }

    const conflictId = Number(err?.keyValue?.id);
    if (Number.isFinite(conflictId)) {
      const restored = await restoreAndUpdatePermission(conflictId, payload);
      if (restored) return restored;
    }

    delete data.id;
    return permissionRepository.create(data);
  }
}

export async function syncPermissionCatalogFromFile(): Promise<PermissionCatalogSyncResult> {
  await syncCounters();
  const hrRoutesFixed = await fixLegacyHrChildRoutes();
  if (hrRoutesFixed > 0) {
    console.log(`Fixed ${hrRoutesFixed} legacy HR child route(s)`);
  }
  const legacyRemoved = await removeLegacyInstallerJobPermissions();

  const flat = flattenCatalog(permissionCatalog as CatalogNode[]);
  const { byId, byKey } = await buildDbMaps();
  const routeToDbId = new Map<string, number>();

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let userPermissionsCreated = 0;

  for (const item of flat) {
    let parentDbId: number | null = null;
    if (item.parentCatalogKey) {
      parentDbId = routeToDbId.get(item.parentCatalogKey) ?? null;
    }

    const lookupKey = item.catalogKey;
    let existing = await findExistingPermission(item, parentDbId, byKey, byId);

    const payload = {
      name: item.name,
      parentId: parentDbId,
      label: item.label,
      icon: item.icon ?? "",
      type: item.type,
      route: item.route,
      order: item.order ?? null,
      component: item.component ?? null,
      hide: item.hide ?? false,
      status: item.status ?? 1,
      newFeature: item.newFeature ?? false,
      children: [],
    };

    let dbId: number;
    if (existing) {
      dbId = existing.id;
      const changed =
        existing.name !== payload.name ||
        existing.label !== payload.label ||
        String(existing.icon || "") !== String(payload.icon || "") ||
        existing.type !== payload.type ||
        existing.route !== payload.route ||
        String(existing.component || "") !== String(payload.component || "") ||
        Boolean(existing.hide) !== Boolean(payload.hide) ||
        Number(existing.parentId || 0) !== Number(payload.parentId || 0) ||
        Number(existing.order ?? 0) !== Number(payload.order ?? 0);

      if (existing.deleted_at || changed) {
        await restoreAndUpdatePermission(dbId, payload);
        const refreshed: any = await permissionRepository.collection.findOne({ id: dbId });
        if (refreshed) {
          byKey.set(lookupKey, refreshed);
          byId.set(dbId, refreshed);
        }
        updated += 1;
      } else {
        unchanged += 1;
      }
    } else {
      const doc: any = await createCatalogPermission(item, payload);
      dbId = doc.id;
      byKey.set(lookupKey, doc);
      byId.set(dbId, doc);
      created += 1;
    }

    if (installerJobsComponent(item.component) || item.route === "installer-jobs" || item.route?.startsWith("installer-jobs")) {
      userPermissionsCreated += await ensureUserPermissions(dbId, item);
    }

    if (item.route === "assistant-settings" || item.component?.includes("/assistant-settings/")) {
      userPermissionsCreated += await ensureUserPermissions(dbId, item);
    }

    if (isHrPermission(item)) {
      userPermissionsCreated += await ensureUserPermissions(dbId, item);
    }

    routeToDbId.set(item.catalogKey, dbId);
  }

  const syncedDbIds = new Set(routeToDbId.values());
  const allDb: any[] = await permissionRepository.collection
    .find({ deleted_at: null })
    .project({ id: 1 })
    .toArray();
  const orphanIds = allDb.map((p) => p.id).filter((id) => !syncedDbIds.has(id));
  let orphansRemoved = 0;
  if (orphanIds.length) {
    await userPermissionRepository.deleteMany({ permission_id: { $in: orphanIds } });
    await permissionRepository.deleteMany({ id: { $in: orphanIds } });
    orphansRemoved = orphanIds.length;
  }

  const roles: any[] = await roleRepository.find({}, { select: "id", lean: true });
  for (const role of roles) {
    if (role?.id != null) invalidatePermissionCache(role.id);
  }

  await ensureHrRoleRoutes().catch((err) => console.error("ensureHrRoleRoutes failed", err));
  await ensureInstallerRoleRoutes().catch((err) => console.error("ensureInstallerRoleRoutes failed", err));
  await ensureCustomerRoleRoutes().catch((err) => console.error("ensureCustomerRoleRoutes failed", err));

  return {
    created,
    updated,
    unchanged,
    legacyRemoved: legacyRemoved + orphansRemoved,
    userPermissionsCreated,
    catalogKeys: flat.map((f) => f.catalogKey),
  };
}

export async function fixLegacyHrChildRoutes(): Promise<number> {
  const parent: any = await permissionRepository.findOne({ route: "hr", parentId: null }, { lean: true });
  if (!parent?.id) return 0;

  const children: any[] = await permissionRepository.find({ parentId: parent.id }, { lean: true });
  let fixed = 0;
  for (const child of children) {
    if (typeof child.route === "string" && child.route.startsWith("hr/")) {
      const route = child.route.replace(/^hr\//, "");
      await permissionRepository.updateById(child.id, { $set: { route } });
      fixed += 1;
    }
  }
  return fixed;
}

/** Ensure HR_EXECUTIVE + SUPER_ADMIN can open HR catalogue and pages. */
export async function ensureHrRoleRoutes(): Promise<{ updated: number; created: number }> {
  const roles: any[] = await roleRepository.find(
    { name: { $in: [Roles.HR_EXECUTIVE, Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO] } },
    { lean: true },
  );
  if (!roles.length) return { updated: 0, created: 0 };

  const hrPerms: any[] = await permissionRepository.find(
    {
      deleted_at: null,
      $or: [{ route: "hr", parentId: null }, { component: { $regex: "/hr/" } }],
    },
    { lean: true },
  );

  let updated = 0;
  let created = 0;
  for (const role of roles) {
    for (const perm of hrPerms) {
      const existing: any = await userPermissionRepository.findOne({
        role_id: role.id,
        permission_id: perm.id,
      });
      const full = [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO].includes(role.name);
      if (existing) {
        if (!existing.enable || existing.deleted_at) {
          await userPermissionRepository.updateById(existing.id, {
            $set: { enable: true, deleted_at: null },
          });
          updated += 1;
        }
        continue;
      }
      await userPermissionRepository.create({
        role_id: role.id,
        permission_id: perm.id,
        enable: true,
        create: full || role.name === Roles.HR_EXECUTIVE,
        can_update: full || role.name === Roles.HR_EXECUTIVE,
        delete: role.name === Roles.SUPER_ADMIN,
        is_user_specific: false,
        is_admin: role.name === Roles.SUPER_ADMIN,
      });
      created += 1;
    }
    invalidatePermissionCache(role.id);
  }
  return { updated, created };
}

/** Ensure INSTALLER role can always open workbench + installer job routes. */
export async function ensureInstallerRoleRoutes(): Promise<{ updated: number; created: number }> {
  const installerRole: any = await roleRepository.findOne({ name: Roles.INSTALLER }, { lean: true });
  if (!installerRole?.id) return { updated: 0, created: 0 };

  const perms: any[] = await permissionRepository.find(
    {
      deleted_at: null,
      $or: [
        { route: "workbench", component: { $regex: "workbench" } },
        { route: "dashboard", type: 0 },
        { route: "installer-jobs" },
        { route: { $regex: "^installer-jobs/" } },
      ],
    },
    { lean: true },
  );

  let updated = 0;
  let created = 0;
  for (const perm of perms) {
    const existing: any = await userPermissionRepository.findOne({
      role_id: installerRole.id,
      permission_id: perm.id,
    });
    if (existing) {
      if (!existing.enable || existing.deleted_at) {
        await userPermissionRepository.updateById(existing.id, {
          $set: { enable: true, deleted_at: null },
        });
        updated += 1;
      }
      continue;
    }
    await userPermissionRepository.create({
      role_id: installerRole.id,
      permission_id: perm.id,
      enable: true,
      create: true,
      can_update: true,
      delete: false,
      is_user_specific: false,
      is_admin: false,
    });
    created += 1;
  }

  invalidatePermissionCache(installerRole.id);
  return { updated, created };
}

/** Ensure CUSTOMER role can open workbench + self-service portal menus. */
export async function ensureCustomerRoleRoutes(): Promise<{ updated: number; created: number }> {
  const customerRole: any = await roleRepository.findOne({ name: Roles.CUSTOMER }, { lean: true });
  if (!customerRole?.id) return { updated: 0, created: 0 };

  const perms: any[] = await permissionRepository.find(
    {
      deleted_at: null,
      $or: [
        { route: "workbench", component: { $regex: "workbench" } },
        { route: "dashboard", type: 0, parentId: null },
        { route: "profile", component: { $regex: "/management/user/profile" } },
        { route: "account", component: { $regex: "/management/user/account" } },
        { route: "management", type: 0, parentId: null },
        { route: "feedback", type: 0, parentId: null },
        { route: "feedback/home" },
        { route: "feedback/complaint" },
        { route: "feedback/suggestion" },
        { route: "training", type: 0, parentId: null },
        { route: "training/my" },
      ],
    },
    { lean: true },
  );

  const managementParent = perms.find((p) => p.route === "management" && !p.parentId);
  const userCatalogue = managementParent
    ? await permissionRepository.findOne(
        { route: "user", parentId: managementParent.id, type: 0 },
        { lean: true },
      )
    : null;
  if (userCatalogue && !perms.some((p) => p.id === userCatalogue.id)) {
    perms.push(userCatalogue);
  }

  let updated = 0;
  let created = 0;
  for (const perm of perms) {
    const existing: any = await userPermissionRepository.findOne({
      role_id: customerRole.id,
      permission_id: perm.id,
    });
    if (existing) {
      if (!existing.enable || existing.deleted_at) {
        await userPermissionRepository.updateById(existing.id, {
          $set: { enable: true, deleted_at: null },
        });
        updated += 1;
      }
      continue;
    }
    await userPermissionRepository.create({
      role_id: customerRole.id,
      permission_id: perm.id,
      enable: true,
      create: false,
      can_update: perm.route === "account" || perm.route === "profile",
      delete: false,
      is_user_specific: false,
      is_admin: false,
    });
    created += 1;
  }

  invalidatePermissionCache(customerRole.id);
  return { updated, created };
}

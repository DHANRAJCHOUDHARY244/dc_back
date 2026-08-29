import { Roles } from "../data/dataInserter";

const DEFAULT_HOME = "/dashboard/workbench";

/** All roles land on workbench first; the page shows role-specific content. */
const ROLE_HOME_CANDIDATES: Partial<Record<string, string[]>> = {
  [Roles.SUPER_ADMIN]: [DEFAULT_HOME],
  [Roles.CEO]: [DEFAULT_HOME],
  [Roles.ADMIN]: [DEFAULT_HOME],
  [Roles.MANAGER]: [DEFAULT_HOME],
  [Roles.HR_EXECUTIVE]: [DEFAULT_HOME],
  [Roles.INSTALLER]: [DEFAULT_HOME, "/installer-jobs"],
  [Roles.ACCOUNTS_MANAGER]: [DEFAULT_HOME, "/finance/dashboard"],
  [Roles.SALES_PERSON]: [DEFAULT_HOME, "/leads", "/dashboard/sales-pipeline"],
  [Roles.SALES_LEADER]: [DEFAULT_HOME, "/leads", "/dashboard/sales-pipeline"],
  [Roles.SENIOR_SALES_EXECUTIVE]: [DEFAULT_HOME, "/leads", "/dashboard/sales-pipeline"],
  [Roles.SALES_EXECUTIVE]: [DEFAULT_HOME, "/leads", "/dashboard/sales-pipeline"],
  [Roles.BUSINESS_DEVELOPMENT_EXECUTIVE]: [DEFAULT_HOME, "/leads", "/dashboard/sales-pipeline"],
  [Roles.LEAD_GENERATION_EXECUTIVE]: [DEFAULT_HOME, "/leads"],
  [Roles.OPERATIONS_MANAGER]: [DEFAULT_HOME, "/installer-jobs", "/all-in-one"],
  [Roles.CUSTOMER_SUPPORT_EXECUTIVE]: [DEFAULT_HOME, "/leads", "/contact-form"],
  [Roles.DIGITAL_MARKETING_EXECUTIVE]: [DEFAULT_HOME, "/leads"],
  [Roles.SEO_MANAGER]: [DEFAULT_HOME, "/leads"],
  [Roles.CONTENT_WRITER]: [DEFAULT_HOME],
  [Roles.SOCIAL_MEDIA_MANAGER]: [DEFAULT_HOME],
  [Roles.GRAPHIC_DESIGNER]: [DEFAULT_HOME],
  [Roles.WEBSITE_DEVELOPER]: [DEFAULT_HOME],
  [Roles.TECHNICAL_SUPPORT]: [DEFAULT_HOME],
  [Roles.QA]: [DEFAULT_HOME],
  [Roles.DATA_ANALYST]: [DEFAULT_HOME],
  [Roles.CUSTOMER]: [DEFAULT_HOME, "/management/user/profile", "/training/my", "/feedback/home"],
};

type PermNode = {
  id?: number | string;
  parentId?: number | string | null;
  type?: number;
  route?: string;
  enable?: boolean;
  component?: string | null;
  frameSrc?: string | null;
  order?: number | null;
  children?: PermNode[];
};

function flatten(nodes: PermNode[] = []): PermNode[] {
  const out: PermNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flatten(node.children));
  }
  return out;
}

function buildPath(node: PermNode, flat: PermNode[], segments: string[] = []): string {
  if (node.route) segments.unshift(node.route);
  if (!node.parentId) return `/${segments.join("/")}`;
  const parent = flat.find((p) => String(p.id) === String(node.parentId));
  if (!parent) return `/${segments.join("/")}`;
  return buildPath(parent, flat, segments);
}

function normalize(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.replace(/\/+$/, "") || "/";
}

function enabledMenuPaths(permissions: PermNode[] = []): Set<string> {
  const flat = flatten(permissions);
  const set = new Set<string>();
  for (const node of flat) {
    if (node.type !== 1) continue;
    if (node.enable === false) continue;
    if (!node.component && !node.frameSrc) continue;
    set.add(normalize(buildPath(node, flat)));
  }
  return set;
}

function pathAllowed(target: string, enabled: Set<string>, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  const norm = normalize(target);
  if (enabled.has(norm)) return true;
  for (const p of enabled) {
    if (p.startsWith(`${norm}/`) || norm.startsWith(`${p}/`)) return true;
  }
  return false;
}

function firstEnabledMenu(
  permissions: PermNode[] = [],
  isSuperAdmin = false,
  preferPaths?: string[],
): string | null {
  const flat = flatten(permissions);
  const menus = flat
    .filter(
      (p) =>
        p.type === 1 &&
        (isSuperAdmin || p.enable !== false) &&
        (p.component || p.frameSrc),
    )
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  if (preferPaths?.length) {
    for (const pref of preferPaths) {
      const norm = normalize(pref);
      if (menus.some((m) => normalize(buildPath(m, flat)) === norm)) return norm;
    }
  }

  if (!menus.length) return null;
  return normalize(buildPath(menus[0], flat));
}

/** Resolve default dashboard path for a role + permission tree. */
export function resolveRoleHomePath(
  roleName?: string,
  permissions: PermNode[] = [],
): string {
  const role = String(roleName || "").toUpperCase();
  const isSuperAdmin = role === Roles.SUPER_ADMIN;
  const enabled = enabledMenuPaths(permissions);
  const candidates = ROLE_HOME_CANDIDATES[role];

  if (candidates?.length) {
    for (const candidate of candidates) {
      if (pathAllowed(candidate, enabled, isSuperAdmin)) {
        return normalize(candidate);
      }
    }
  }

  return firstEnabledMenu(permissions, isSuperAdmin, candidates) || DEFAULT_HOME;
}

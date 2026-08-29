/**
 * Merge dc_crm.permissions.json (DB export) with catalogue additions/overrides.
 * Writes unified src/data/permissions.ts — run before seedPermissionsFromCatalog.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/mergePermissionsCatalog.ts
 */
import fs from "fs";
import path from "path";

type FlatPerm = {
  id: number;
  name: string;
  parentId?: number | null;
  label: string;
  icon?: string | null;
  type: number;
  route: string;
  order?: number | null;
  component?: string | null;
  hide?: boolean | number | null;
  status?: number | null;
  newFeature?: boolean | null;
};

type CatalogNode = Omit<FlatPerm, "parentId"> & {
  parentId?: number | null;
  children?: CatalogNode[];
};

const ROOT = path.join(__dirname, "..", "data");
const dcCrmPermissions = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dc_crm.permissions.json"), "utf8"),
) as FlatPerm[];

/** Legacy / duplicate DB rows to drop from merged catalogue. */
const SKIP_IDS = new Set([
  124, 125, 126, 127,
  174, 175, 176, 177, 178,
  180, 181,
  119,
  193,
]);

const SKIP_ROUTES = new Set([
  "../installer-jobs",
  "../installer-jobs/job/:id",
  "../installer-jobs/calendar",
]);

/** Root menu order (user sequence). */
const ORDER_OVERRIDES: Record<string, number> = {
  dashboard: 1,
  chat: 2,
  assessment: 3,
  quote: 4,
  "green-sketch": 5,
  invoice: 6,
  "contact-form": 7,
  leads: 8,
  "product-items": 9,
  "stock-order": 10,
  "master-tasks": 11,
  rebates: 12,
  calculator: 13,
  "solar-battery-crm": 14,
  "all-in-one": 15,
  sla: 16,
  customer: 17,
  "sales-person": 18,
  installers: 19,
  map: 20,
  company: 21,
  finance: 22,
  training: 23,
  "installer-jobs": 24,
  management: 25,
  "document-center": 26,
  "system-monitor": 27,
  "system-logs": 28,
  "activity-tracker": 29,
  workflow: 30,
  hr: 31,
  feedback: 32,
  calendar: 33,
  qr: 34,
  task: 35,
  job: 36,
};

/** Modules not in DB export but required by the app. */
const CATALOG_ADDITIONS: FlatPerm[] = [
  {
    id: 179,
    name: "Installer Jobs",
    label: "sys.menu.installer_jobs",
    icon: "solar:case-round-bold-duotone",
    type: 1,
    route: "installer-jobs",
    order: 24,
    component: "/installer-jobs/dashboard/index.tsx",
  },
  {
    id: 182,
    name: "Installer Job Workspace",
    label: "sys.menu.installer_jobs.workspace",
    type: 1,
    route: "installer-jobs/job/:id",
    component: "/installer-jobs/job/index.tsx",
    hide: true,
  },
  {
    id: 183,
    name: "Installer Calendar",
    label: "sys.menu.installer_jobs.calendar",
    type: 1,
    route: "installer-jobs/calendar",
    component: "/installer-jobs/calendar/index.tsx",
    hide: true,
  },
  {
    id: 195,
    name: "Stock Orders",
    label: "sys.menu.stock_order",
    icon: "mdi:package-variant-closed",
    type: 0,
    route: "stock-order",
    order: 10,
  },
  {
    id: 185,
    name: "Master Tasks",
    label: "sys.menu.master_tasks",
    icon: "solar:checklist-minimalistic-bold",
    type: 0,
    route: "master-tasks",
    order: 11,
  },
  {
    id: 186,
    name: "Task Centre",
    parentId: 185,
    label: "sys.menu.master_tasks.centre",
    type: 1,
    route: "centre",
    component: "/master-tasks/MasterTaskCentrePage.tsx",
  },
  {
    id: 187,
    name: "Follow-ups",
    parentId: 185,
    label: "sys.menu.master_tasks.follow_ups",
    type: 1,
    route: "follow-ups",
    component: "/master-tasks/FollowUpsPage.tsx",
  },
  {
    id: 188,
    name: "Task Settings",
    parentId: 185,
    label: "sys.menu.master_tasks.settings",
    type: 1,
    route: "settings",
    component: "/master-tasks/MasterTaskSettingsPage.tsx",
  },
  {
    id: 189,
    name: "Rebates & Incentives",
    label: "sys.menu.rebates",
    icon: "solar:hand-money-bold-duotone",
    type: 1,
    route: "rebates",
    order: 12,
    component: "/rebates/index.tsx",
  },
  {
    id: 196,
    name: "Solar Battery CRM",
    label: "sys.menu.solarBatteryCrm",
    icon: "solar:bolt-bold-duotone",
    type: 1,
    route: "solar-battery-crm",
    order: 14,
    component: "/solar-battery-crm/index.tsx",
  },
  {
    id: 190,
    name: "Job SLA",
    label: "sys.menu.sla",
    icon: "solar:alarm-bold",
    type: 0,
    route: "sla",
    order: 16,
  },
  {
    id: 191,
    name: "Delayed Jobs",
    parentId: 190,
    label: "sys.menu.sla.delayed_jobs",
    type: 1,
    route: "delayed-jobs",
    component: "/sla/DelayedJobsPage.tsx",
  },
  {
    id: 192,
    name: "SLA Settings",
    parentId: 190,
    label: "sys.menu.sla.settings",
    type: 1,
    route: "settings",
    component: "/sla/SlaSettingsPage.tsx",
  },
];

function normalizeHide(hide?: boolean | number | null) {
  return hide === true || hide === 1;
}

function normalizeRow(p: FlatPerm): FlatPerm {
  return {
    ...p,
    hide: normalizeHide(p.hide),
    icon: p.icon || undefined,
    component: p.component || null,
    order: p.order ?? null,
    parentId: p.parentId ?? null,
  };
}

function mergeCatalog(): FlatPerm[] {
  const byId = new Map<number, FlatPerm>();

  for (const p of dcCrmPermissions) {
    if (SKIP_IDS.has(p.id) || SKIP_ROUTES.has(p.route)) continue;
    byId.set(p.id, normalizeRow(p));
  }

  // Overlay catalogue additions (new modules + structure fixes)
  for (const p of CATALOG_ADDITIONS) {
    byId.set(p.id, normalizeRow(p));
  }

  const flat = [...byId.values()];

  // Stock list: DB id 104, under stock-order parent 194
  const stockList = flat.find((p) => p.id === 104);
  const stockParent = byId.get(195);
  if (stockList && stockParent?.route === "stock-order") {
    stockList.parentId = 195;
    stockList.route = "list";
    stockList.name = "All Orders";
    stockList.label = "sys.menu.stock_order_list";
    stockList.component = "/stockOrder/list/index.tsx";
    stockList.type = 1;
  } else if (stockList && stockList.route === "stock-list") {
    // legacy flat stock-list row — reparent under stock-order
    stockList.parentId = 195;
    stockList.route = "list";
    stockList.name = "All Orders";
    stockList.label = "sys.menu.stock_order_list";
  }

  // Stock-order parent id 195
  const stockOrderParent = flat.find((p) => p.route === "stock-order" && !p.parentId);
  if (stockOrderParent) {
    stockOrderParent.id = 195;
    const list = flat.find((p) => p.component === "/stockOrder/list/index.tsx");
    if (list) list.parentId = 195;
  }

  // Solar battery CRM id 196
  const solarCrm = flat.find((p) => p.route === "solar-battery-crm");
  if (solarCrm) solarCrm.id = 196;

  // Calculator 115, Solar Sketch 116 — already in JSON
  const calc = flat.find((p) => p.route === "calculator");
  if (calc) {
    calc.id = 115;
    calc.label = "sys.menu.calculator";
    calc.order = ORDER_OVERRIDES.calculator;
  }

  const sketch = flat.find((p) => p.route === "green-sketch");
  if (sketch) {
    sketch.id = 116;
    sketch.order = ORDER_OVERRIDES["green-sketch"];
  }

  // Pre-approval: parent 120, children 121-123
  const allInOne = flat.find((p) => p.route === "all-in-one" && !p.parentId);
  if (allInOne) {
    allInOne.id = 120;
    allInOne.order = ORDER_OVERRIDES["all-in-one"];
    for (const child of flat.filter((p) => p.component?.includes("/all-in-one/"))) {
      child.parentId = 120;
      if (child.route === "list") child.id = 121;
      if (child.route === "job/new") {
        child.id = 122;
        child.hide = true;
      }
      if (child.route === "job/:id") {
        child.id = 123;
        child.hide = true;
      }
    }
  }

  // Workflow catalogue 113 + admin child 114
  if (!byId.has(113)) {
    flat.push({
      id: 113,
      name: "Workflow",
      label: "sys.menu.workflows.index",
      icon: "catppuccin:folder-workflows-open",
      type: 0,
      route: "workflow",
      order: ORDER_OVERRIDES.workflow,
    });
  }
  const wfChild = flat.find((p) => p.component === "/workflow/WorkflowDashboard.tsx");
  if (wfChild) {
    wfChild.id = 114;
    wfChild.parentId = 113;
    wfChild.route = "workflow-admin";
    wfChild.name = "Admin Workflow";
    wfChild.label = "sys.menu.workflows.admin_workflow";
    wfChild.type = 1;
  }

  // Finance accounts → id 118
  const accounts = flat.find((p) => p.component === "/finance/accounts/AccountsPage.tsx");
  if (accounts) accounts.id = 118;

  // Custom contact docs → 108-110
  const docParent = 70;
  for (const [route, id] of [
    ["custom-contact-list", 108],
    ["custom-contact-add-new", 109],
    ["custom-contact-list/:id", 110],
  ] as const) {
    const row = flat.find((p) => p.route === route && p.component?.includes("/customContact/"));
    if (row) {
      row.id = id;
      row.parentId = docParent;
    }
  }

  // CRM settings under system (id 117) — ensure present
  if (!flat.some((p) => p.id === 117)) {
    flat.push({
      id: 117,
      name: "Crm-Setting",
      parentId: 12,
      label: "Crm-Setting",
      icon: "streamline-plump:page-setting",
      type: 1,
      route: "crm-settings",
      component: "/management/system/crm-settings/index.tsx",
    });
  }

  // AI Assistant settings under system (id 200)
  if (!flat.some((p) => p.id === 200)) {
    flat.push({
      id: 200,
      name: "AI Assistant",
      parentId: 12,
      label: "AI Assistant",
      icon: "solar:chat-round-dots-bold-duotone",
      type: 1,
      route: "assistant-settings",
      component: "/management/system/assistant-settings/index.tsx",
    });
  }

  // Sales pipeline under dashboard (id 3)
  if (!flat.some((p) => p.id === 3)) {
    flat.push({
      id: 3,
      name: "Sales Pipeline",
      parentId: 1,
      label: "Sales Pipeline",
      type: 1,
      route: "sales-pipeline",
      component: "/dashboard/sales-pipeline/index.tsx",
    });
  }

  // Legacy job module — keep but hidden
  for (const id of [54, 56, 57]) {
    const row = flat.find((p) => p.id === id);
    if (row) row.hide = true;
  }

  // Customer analysis placeholder (id 173)
  const custAnalysis = flat.find((p) => p.id === 173);
  if (custAnalysis) custAnalysis.hide = true;

  // Installer jobs canonical rows
  const ijMain = flat.find((p) => p.route === "installer-jobs" && p.component?.includes("dashboard"));
  if (ijMain) {
    ijMain.id = 179;
    ijMain.parentId = null;
    ijMain.order = ORDER_OVERRIDES["installer-jobs"];
  }
  const ijWs = flat.find((p) => p.component === "/installer-jobs/job/index.tsx");
  if (ijWs) {
    ijWs.id = 182;
    ijWs.parentId = null;
    ijWs.route = "installer-jobs/job/:id";
    ijWs.hide = true;
  }
  const ijCal = flat.find((p) => p.component === "/installer-jobs/calendar/index.tsx");
  if (ijCal) {
    ijCal.id = 183;
    ijCal.parentId = null;
    ijCal.route = "installer-jobs/calendar";
    ijCal.hide = true;
  }

  // Root order overrides
  for (const p of flat) {
    if (!p.parentId && ORDER_OVERRIDES[p.route] != null) {
      p.order = ORDER_OVERRIDES[p.route];
    }
  }

  // Management order
  const mgmt = flat.find((p) => p.id === 8);
  if (mgmt) mgmt.order = ORDER_OVERRIDES.management;

  // Deduplicate by id (last wins)
  const deduped = new Map<number, FlatPerm>();
  for (const p of flat) deduped.set(p.id, p);

  return [...deduped.values()];
}

function buildTree(flat: FlatPerm[]): CatalogNode[] {
  const nodes = new Map<number, CatalogNode>();
  for (const p of flat) {
    const { parentId, ...rest } = p;
    nodes.set(p.id, { ...rest, children: [] });
  }

  const roots: CatalogNode[] = [];
  for (const p of flat) {
    const node = nodes.get(p.id)!;
    if (p.parentId && nodes.has(p.parentId)) {
      nodes.get(p.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const clean = (list: CatalogNode[]): CatalogNode[] =>
    list
      .map((n) => {
        const children = n.children?.length ? clean(n.children) : undefined;
        const out: CatalogNode = { ...n };
        if (children?.length) out.children = children;
        else delete out.children;
        return out;
      })
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return clean(roots);
}

function serializeNode(node: CatalogNode, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}{`);
  lines.push(`${indent}    "id": ${node.id},`);
  lines.push(`${indent}    "name": ${JSON.stringify(node.name)},`);
  if (node.parentId != null) lines.push(`${indent}    "parentId": ${node.parentId},`);
  lines.push(`${indent}    "label": ${JSON.stringify(node.label)},`);
  if (node.icon) lines.push(`${indent}    "icon": ${JSON.stringify(node.icon)},`);
  lines.push(`${indent}    "type": ${node.type},`);
  lines.push(`${indent}    "route": ${JSON.stringify(node.route)},`);
  if (node.order != null) lines.push(`${indent}    "order": ${node.order},`);
  if (node.component) lines.push(`${indent}    "component": ${JSON.stringify(node.component)},`);
  if (node.hide) lines.push(`${indent}    "hide": true,`);

  if (node.children?.length) {
    lines.push(`${indent}    "children": [`);
    node.children.forEach((child, i) => {
      lines.push(
        serializeNode({ ...child, parentId: node.id }, indent + "        ") +
          (i < node.children!.length - 1 ? "," : ""),
      );
    });
    lines.push(`${indent}    ]`);
  }

  lines.push(`${indent}}`);
  return lines.join("\n");
}

function writePermissionsTs(tree: CatalogNode[]) {
  const body = tree.map((n, i) => serializeNode(n, "    ") + (i < tree.length - 1 ? "," : "")).join("\n");
  fs.writeFileSync(path.join(ROOT, "permissions.ts"), `export default[\n${body}\n]\n`, "utf8");
}

function main() {
  const flat = mergeCatalog();
  const ids = flat.map((p) => p.id).sort((a, b) => a - b);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    console.error("Duplicate ids remain:", [...new Set(dupes)]);
    process.exit(1);
  }

  const tree = buildTree(flat);
  writePermissionsTs(tree);

  console.log(
    JSON.stringify(
      { ok: true, flatCount: flat.length, rootCount: tree.length, maxId: Math.max(...ids) },
      null,
      2,
    ),
  );
}

main();

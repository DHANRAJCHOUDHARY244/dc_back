import { MenuItem } from "@constants/common.interface";

function removeNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls);
  } else if (obj instanceof Date) {
    return obj; // Preserve Date objects
  } else if (obj && typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        const cleanedValue = removeNulls(value);
        if (!(Array.isArray(cleanedValue) && cleanedValue.length === 0 && key === "children")) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }
  return obj;
}


export function buildMenuTree(items: MenuItem[]): MenuItem[] {
  const map = new Map<string, MenuItem>();
  const tree: MenuItem[] = [];

  items.forEach((item) => {
    item.children = [];
    map.set(String(item.id), item);
  });

  items.forEach((item) => {
    if (item.parentId != null && item.parentId !== "") {
      const parent = map.get(String(item.parentId));
      if (parent) {
        parent.children!.push(item);
      } else {
        tree.push(item);
      }
    } else {
      tree.push(item);
    }
  });

  return removeNulls(tree);
}

export function buildMenuTreePermissionGrp(items: MenuItem[]): MenuItem[] {
  const map = new Map<string, MenuItem>();
  const tree: MenuItem[] = [];

  items.forEach((item) => {
    item.children = [];
    const key = String(item.permission_id ?? item.id);
    map.set(key, item);
  });

  items.forEach((item) => {
    const parentKey = item.parentId != null && item.parentId !== "" ? String(item.parentId) : null;
    if (parentKey) {
      const parent = map.get(parentKey);
      if (parent) {
        parent.children!.push(item);
      } else {
        tree.push(item);
      }
    } else {
      tree.push(item);
    }
  });

  return removeNulls(tree);
}
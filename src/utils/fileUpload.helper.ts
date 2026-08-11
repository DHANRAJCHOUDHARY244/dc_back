import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UploadedFile } from "express-fileupload";
import { UploadCategory } from "@constants/common.enum";

/* ================= TYPES ================= */

interface UploadConfig {
  category: UploadCategory;
  files: UploadedFile | UploadedFile[];
  entityId?: number | string;
  deleteOldPaths?: string[];
  allowedTypes?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
}

/* ================= CATEGORY RESOLVER ================= */

const resolveUploadPath = (
  category: UploadCategory,
  entityId?: string | number
) => {
  let base = "uploads";
  let subPath = "";

  switch (category) {
    case UploadCategory.USER_PROFILE:
      subPath = `users/${entityId}`;
      break;

    case UploadCategory.DOCUMENT:
      subPath = `documents/${entityId}`;
      break;

    case UploadCategory.STOCK_CONFIRM:
      subPath = `stocks/${entityId}/confirm`;
      break;

    case UploadCategory.STOCK_DELIVERED:
      subPath = `stocks/${entityId}/delivered`;
      break;

    case UploadCategory.INVOICE:
      subPath = `invoices/${entityId}`;
      break;

    case UploadCategory.ACCOUNTS_STOCK_INVOICE:
      subPath = `accounts/stock-invoices/${entityId}`;
      break;

    case UploadCategory.ALL_IN_ONE_JOB:
      subPath = `all-in-one/${entityId}`;
      break;

    case UploadCategory.QUOTE:
      subPath = `quotes/${entityId}`;
      break;

    case UploadCategory.ASSESSMENT:
      subPath = `assessments/${entityId}`;
      break;

    case UploadCategory.CRM_BRANDING:
      subPath = `crm/branding`;
      break;

    case UploadCategory.CHAT:
      subPath = `chats/${entityId}`;
      break;

    case UploadCategory.TRAINING:
      subPath = `training/${entityId}`;
      break;

    case UploadCategory.FEEDBACK:
      subPath = `feedback/${entityId}`;
      break;

    default:
      subPath = `misc`;
  }

  const absPath = path.join(process.cwd(), base, subPath);
  const urlPath = `/${base}/${subPath}`;

  return { absPath, urlPath };
};

/* ================= UTIL FUNCTIONS ================= */

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const safeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const generateName = (original: string, entityId?: string | number) => {
  const ext = path.extname(original);
  const hash = crypto.randomBytes(4).toString("hex");
  return `${entityId ?? "file"}_${Date.now()}_${hash}${ext}`;
};

const deleteFiles = (paths: string[] = []) => {
  for (const p of paths) {
    const abs = path.join(process.cwd(), p);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
};

/* ================= 🚀 MAIN UPLOADER ================= */

export const uploadFiles = async ({
  category,
  files,
  entityId,
  deleteOldPaths = [],
  allowedTypes = [],
  maxSizeMB = 100,
  multiple = false,
}: UploadConfig) => {

  const { absPath, urlPath } = resolveUploadPath(category, entityId);

  ensureDir(absPath);
  deleteFiles(deleteOldPaths);

  const fileArray = Array.isArray(files) ? files : [files];
  const saved: any[] = [];

  for (const file of fileArray) {
    if (allowedTypes.length && !allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}`);
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`File exceeds ${maxSizeMB}MB`);
    }

    const cleanName = safeName(file.name);
    const storedName = generateName(cleanName, entityId);
    const absoluteFilePath = path.join(absPath, storedName);

    await file.mv(absoluteFilePath);

    saved.push({
      original_name: file.name,
      stored_name: storedName,
      mime_type: file.mimetype, 
      size_bytes: file.size,
      url: `${process.env.BASE_URL}${urlPath}/${storedName}`,
      uploaded_at: new Date(),
    });
  }

  return multiple ? saved : saved[0];
};


export const deleteFileFromStorage = async (filePath: string) => {
  try {
    const fullPath = path.join(process.cwd(), filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log("File deleted:", fullPath);
    }
  } catch (err) {
    console.error("File delete error:", err);
  }
};

export const getRelativeFilePath = (fullUrl: string) => {
  if (!fullUrl) return null;

  const BASE_URL = process.env.BASE_URL || "";

  return fullUrl.replace(BASE_URL, "");
};
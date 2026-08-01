import { Response } from "express";
import { fileUpload } from "express-fileupload";
import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { UploadCategory } from "@constants/common.enum";
import { ReE, ReS } from "@services/generalHelper.service";
import { crmSettingsRepository } from "@repositories";
import type { CrmMetadataField } from "../types/crmSettings.types";
import {
  clearCrmSettingsCache,
  getOrCreateSettings,
  pickPublicCompanyConfig,
} from "@services/crmSettings.service";
import { getRelativeFilePath, uploadFiles } from "@utils/fileUpload.helper";

const BRANDING_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

const ASSET_FIELDS = {
  logo: "logo_url",
  favicon: "favicon_url",
  watermark: "watermark_logo_url",
  quote_logo: "quote_logo_url",
  invoice_logo: "invoice_logo_url",
  signature: "company_signature_url",
  email_logo: "email_logo_url",
} as const;

type BrandingAssetType = keyof typeof ASSET_FIELDS;

function normalizeMetadataFields(fields: unknown): CrmMetadataField[] | null {
  if (!Array.isArray(fields)) return null;
  return fields.map((f: any, i: number) => ({
    id: String(f.id || `field-${i}`),
    key: String(f.key || "").trim(),
    label: String(f.label || "").trim(),
    value: String(f.value ?? ""),
    type: ["text", "url", "email", "phone", "textarea"].includes(f.type) ? f.type : "text",
    sort_order: typeof f.sort_order === "number" ? f.sort_order : i,
    visible: f.visible !== false,
  }));
}

class CrmSettingsController {
  async getPublicBranding(_req: AuthenticatedRequest, res: Response) {
    try {
      // Always serve fresh DB values — avoid browsers caching old logo/favicon URLs (304).
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const settings = await getOrCreateSettings();
      return ReS(res, SUCCESS_CODE, "Company config fetched.", pickPublicCompanyConfig(settings));
    } catch (error: any) {
      console.error("[getPublicBranding]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getSettings(_req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await getOrCreateSettings();
      return ReS(res, SUCCESS_CODE, "CRM settings fetched.", settings);
    } catch (error: any) {
      console.error("[getSettings]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async uploadBrandingAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const assetType = String(req.body?.type || "") as BrandingAssetType;
      if (!ASSET_FIELDS[assetType]) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "type must be logo, favicon, watermark, quote_logo, invoice_logo, signature, or email_logo",
        );
      }

      const files = req.files as fileUpload.FileArray;
      if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No file uploaded");

      const file = files.files as fileUpload.UploadedFile;
      const settings = await getOrCreateSettings();
      const field = ASSET_FIELDS[assetType];
      const oldUrl = settings[field] as string | undefined;
      const oldPath =
        oldUrl && oldUrl.includes("/uploads/") ? getRelativeFilePath(oldUrl) : null;

      const uploaded = await uploadFiles({
        category: UploadCategory.CRM_BRANDING,
        files: file,
        entityId: "crm",
        deleteOldPaths: oldPath ? [oldPath] : [],
        allowedTypes: BRANDING_IMAGE_TYPES,
        maxSizeMB: assetType === "favicon" ? 1 : 5,
      });

      const updated = await crmSettingsRepository.updateById(settings.id, {
        $set: { [field]: uploaded.url },
      });
      clearCrmSettingsCache();

      return ReS(res, SUCCESS_CODE, `${assetType} uploaded.`, {
        type: assetType,
        url: uploaded.url,
        settings: updated,
        branding: pickPublicCompanyConfig(updated),
      });
    } catch (error: any) {
      console.error("[uploadBrandingAsset]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await getOrCreateSettings();
      const body = req.body || {};

      const allowed = [
        "company_name",
        "company_name_short",
        "abn",
        "arn_number",
        "mobile",
        "phone",
        "email",
        "support_email",
        "address",
        "logo_url",
        "favicon_url",
        "watermark_logo_url",
        "quote_logo_url",
        "invoice_logo_url",
        "company_signature_url",
        "email_logo_url",
        "website",
        "website_display",
        "refer_friend_url",
        "contact_us_url",
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      if (body.metadata_fields !== undefined) {
        const normalized = normalizeMetadataFields(body.metadata_fields);
        if (!normalized) return ReE(res, BAD_REQUEST_CODE, "metadata_fields must be an array");
        updates.metadata_fields = normalized.sort((a, b) => a.sort_order - b.sort_order);
      }

      const updated = await crmSettingsRepository.updateById(settings.id, { $set: updates });
      clearCrmSettingsCache();
      return ReS(res, SUCCESS_CODE, "CRM settings updated.", updated);
    } catch (error: any) {
      console.error("[updateSettings]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async reorderMetadataFields(req: AuthenticatedRequest, res: Response) {
    try {
      const { fieldIds } = req.body as { fieldIds?: string[] };
      if (!Array.isArray(fieldIds) || !fieldIds.length) {
        return ReE(res, BAD_REQUEST_CODE, "fieldIds array is required");
      }

      const settings = await getOrCreateSettings();
      const fields = (settings.metadata_fields as CrmMetadataField[]) || [];
      const map = new Map(fields.map((f) => [f.id, f]));

      const reordered: CrmMetadataField[] = [];
      fieldIds.forEach((id, index) => {
        const field = map.get(id);
        if (field) reordered.push({ ...field, sort_order: index });
      });

      fields.forEach((f) => {
        if (!fieldIds.includes(f.id)) {
          reordered.push({ ...f, sort_order: reordered.length });
        }
      });

      const updated = await crmSettingsRepository.updateById(settings.id, {
        $set: { metadata_fields: reordered },
      });
      clearCrmSettingsCache();
      return ReS(res, SUCCESS_CODE, "Metadata fields reordered.", updated);
    } catch (error: any) {
      console.error("[reorderMetadataFields]", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new CrmSettingsController();

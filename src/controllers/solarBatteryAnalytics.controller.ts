import { Response } from "express";
import path from "path";
import fs from "fs/promises";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { analyzeSolarBatteryBill } from "@services/solarBatteryAnalytics.service";
import { solarBatteryBillRepository } from "@repositories";
import { fileUpload } from "express-fileupload";

const PREFIX = "/uploads/solar-battery-analytics";

function absoluteFromPublicPath(filePath: string): string {
  const rel = String(filePath || "").replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

function publicUrl(filePath: string): string {
  const base = String(process.env.BASE_URL || "").replace(/\/$/, "");
  const p = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return base ? `${base}${p}` : p;
}

class SolarBatteryAnalyticsController {
  /** List saved bill copies for the current user (newest first). */
  async listBills(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.user?.id);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

      const rows: any[] = await solarBatteryBillRepository.find(
        { user_id: userId },
        { sort: { created_at: -1 }, lean: true, limit: 50 },
      );

      const data = (rows || []).map((r) => ({
        id: r.id,
        original_name: r.original_name,
        file_path: r.file_path,
        file_url: publicUrl(r.file_path),
        mime_type: r.mime_type,
        size_bytes: r.size_bytes,
        customer_name: r.customer_name,
        nmi: r.nmi,
        retailer: r.retailer,
        extracted: r.extracted,
        has_inputs: Boolean(r.inputs),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      return ReS(res, SUCCESS_CODE, "Saved bills", data);
    } catch (e: any) {
      console.error("solarBatteryAnalytics.listBills:", e?.message || e);
      return ReE(res, SERVER_ERROR_CODE, e?.message || "Failed to list bills");
    }
  }

  async analyze(req: AuthenticatedRequest, res: Response) {
    let savedPath: string | null = null;
    let shouldCleanupOnError = false;
    try {
      const userId = Number(req.user?.id);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

      const file = (req.files as fileUpload.FileArray | undefined)?.file as
        | fileUpload.UploadedFile
        | fileUpload.UploadedFile[]
        | undefined;
      const uploaded = Array.isArray(file) ? file[0] : file;

      const manualRaw = req.body?.manual ?? req.body?.manualJson ?? null;
      const manualNotes = req.body?.notes ?? req.body?.manualNotes ?? null;
      const reuseBillId = req.body?.billId ? Number(req.body.billId) : null;

      let fileName: string | undefined;
      let mimeType: string | undefined;
      let originalName = "";
      let sizeBytes = 0;
      let existingBill: any = null;

      if (reuseBillId && Number.isFinite(reuseBillId)) {
        existingBill = await solarBatteryBillRepository.findOne(
          { id: reuseBillId, user_id: userId },
          { lean: true },
        );
        if (!existingBill) return ReE(res, RESOURCE_NOT_FOUND, "Saved bill not found");
        savedPath = absoluteFromPublicPath(existingBill.file_path);
        try {
          await fs.access(savedPath);
        } catch {
          return ReE(res, RESOURCE_NOT_FOUND, "Saved bill file is missing on disk");
        }
        fileName = existingBill.original_name || existingBill.stored_name;
        mimeType = existingBill.mime_type;
        originalName = existingBill.original_name || fileName || "";
      } else if (uploaded) {
        const uploadDir = path.join(process.cwd(), "uploads", "solar-battery-analytics", String(userId));
        await fs.mkdir(uploadDir, { recursive: true });
        const safeName = `${Date.now()}-${String(uploaded.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        savedPath = path.join(uploadDir, safeName);
        await uploaded.mv(savedPath);
        shouldCleanupOnError = true;
        fileName = uploaded.name;
        mimeType = uploaded.mimetype;
        originalName = uploaded.name;
        sizeBytes = Number(uploaded.size) || 0;
      }

      if (!savedPath && !manualRaw && !String(manualNotes || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Upload a bill file, reuse a saved bill, or provide manual details");
      }

      const result = await analyzeSolarBatteryBill({
        filePath: savedPath || undefined,
        fileName,
        mimeType,
        manualJson: manualRaw,
        manualNotes,
      });

      let billRecord: any = existingBill;
      const publicPath = savedPath
        ? `${PREFIX}/${userId}/${path.basename(savedPath)}`.replace(/\\/g, "/")
        : existingBill?.file_path;

      if (uploaded && savedPath && publicPath) {
        billRecord = await solarBatteryBillRepository.create({
          user_id: userId,
          original_name: originalName,
          stored_name: path.basename(savedPath),
          file_path: publicPath.startsWith("/") ? publicPath : `/${publicPath}`,
          mime_type: mimeType || "",
          size_bytes: sizeBytes,
          inputs: result.inputs,
          extracted: result.extracted,
          customer_name: result.extracted.customerName || "",
          nmi: result.extracted.nmi || "",
          retailer: result.extracted.retailer || "",
        });
        shouldCleanupOnError = false;
      } else if (existingBill) {
        await solarBatteryBillRepository.updateById(existingBill.id, {
          $set: {
            inputs: result.inputs,
            extracted: result.extracted,
            customer_name: result.extracted.customerName || existingBill.customer_name || "",
            nmi: result.extracted.nmi || existingBill.nmi || "",
            retailer: result.extracted.retailer || existingBill.retailer || "",
          },
        });
        billRecord = await solarBatteryBillRepository.findOne({ id: existingBill.id }, { lean: true });
      }

      const file_path = billRecord?.file_path || (publicPath?.startsWith("/") ? publicPath : publicPath ? `/${publicPath}` : null);

      return ReS(res, SUCCESS_CODE, "Solar battery analytics inputs generated", {
        ...result,
        bill: file_path
          ? {
              id: billRecord?.id ?? null,
              original_name: billRecord?.original_name || originalName,
              file_path,
              file_url: publicUrl(file_path),
              mime_type: billRecord?.mime_type || mimeType || "",
            }
          : null,
      });
    } catch (e: any) {
      console.error("solarBatteryAnalytics.analyze:", e?.message || e);
      if (shouldCleanupOnError && savedPath) {
        try {
          await fs.unlink(savedPath);
        } catch {
          /* ignore */
        }
      }
      return ReE(res, SERVER_ERROR_CODE, e?.message || "Failed to analyze bill");
    }
  }
}

export default new SolarBatteryAnalyticsController();

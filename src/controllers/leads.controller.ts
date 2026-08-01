import XLSX from "xlsx";
import { Response } from "express";
import { leadRepository } from "@repositories";
import { ReS, ReE } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, RESOURCE_NOT_FOUND } from "@constants/serverCode";
import { AuthenticatedRequest, DocumentsAuthenticatedRequest } from "@constants/common.interface";

class LeadsController {
  fixedKeys = ["lead_id", "date", "time", "name", "phone", "email", "address", "note", "remark"];

  async getMetadata(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const file = req.files?.leadDocs as any;
      if (!file) return ReE(res, SERVER_ERROR_CODE, "File is required");

      const workbook = XLSX.read(file.data, { type: "buffer" });

      const sheets = workbook.SheetNames.map((name) => {
        const ws = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const columns = Object.keys(rows[0] || {}).map((c) => c.toLowerCase().trim());

        return {
          sheetName: name,
          columns,
          columnCount: columns.length,
          recordCount: rows.length,
        };
      });

      return ReS(res, SUCCESS_CODE, "Metadata extracted", {
        fileName: file.name,
        mimeType: file.mimetype,
        sizeKB: (file.size / 1024).toFixed(2),
        sheetCount: sheets.length,
        sheets,
      });
    } catch (error: any) {
      console.error("Metadata Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Error: ${error.message}`);
    }
  }

  async processSheet(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const file = req.files?.leadDocs as any;
      const { sheetName } = req.body;

      if (!file) return ReE(res, SERVER_ERROR_CODE, "File is required");
      if (!sheetName) return ReE(res, SERVER_ERROR_CODE, "sheetName is required");

      const workbook = XLSX.read(file.data, { type: "buffer" });
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return ReE(res, SERVER_ERROR_CODE, "Invalid sheetName");

      const excelRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const formatted = excelRows.map((row: any) => {
        const normalized = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k.toLowerCase().trim(),
            typeof v === "string" ? v.trim() : v,
          ]),
        );

        const clean: any = {};
        this.fixedKeys.forEach((key) => (clean[key] = normalized[key] ?? ""));
        clean.uploaded_by = req.user?.id || null;
        clean.is_csv = true;
        return clean;
      });

      const errors: any[] = [];
      formatted.forEach((row, index) => {
        const missing = [];
        if (!row.name) missing.push("name");
        if (!row.phone) missing.push("phone");
        if (missing.length > 0) errors.push({ row: index + 1, missing });
      });

      if (errors.length > 0) {
        return ReE(res, SERVER_ERROR_CODE, "Validation failed");
      }

      const leadIDs = formatted.map((l) => l?.lead_id).filter(Boolean);
      const existing = await leadRepository.find({ lead_id: { $in: leadIDs } }, { lean: true });
      const existingIDs = new Set(existing.map((e: any) => e?.lead_id));
      const duplicates = formatted.filter((l) => existingIDs.has(l?.lead_id));
      const uniqueRows = formatted.filter((l) => !existingIDs.has(l?.lead_id));

      if (uniqueRows.length > 0) {
        await leadRepository.createMany(uniqueRows);
      }

      return ReS(res, SUCCESS_CODE, "Sheet processed successfully", {
        savedCount: uniqueRows.length,
        duplicateCount: duplicates.length,
        duplicates,
      });
    } catch (error: any) {
      console.error("Process Sheet Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Error: ${error.message}`);
    }
  }

  async create(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const lead = await leadRepository.create(req.body);
      return ReS(res, SUCCESS_CODE, "Lead created", lead);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async list(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, search, phone, email, name } = req.query as any;
      const filter: Record<string, unknown> = {};

      if (search) filter.name = { $regex: search, $options: "i" };
      if (phone) filter.phone = phone;
      if (email) filter.email = email;
      if (name) filter.name = { $regex: name, $options: "i" };

      const { rows, count } = await leadRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { created_at: -1 },
      });

      return ReS(res, SUCCESS_CODE, "Leads fetched", {
        leads: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          totalPages: Math.ceil(count / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async update(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      await leadRepository.updateById(Number(id), { $set: req.body });
      return ReS(res, SUCCESS_CODE, "Lead updated");
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async delete(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      await leadRepository.deleteById(Number(id));
      return ReS(res, SUCCESS_CODE, "Lead deleted");
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async bulkDelete(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const ids = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return ReE(res, SERVER_ERROR_CODE, "No IDs provided");
      }

      await leadRepository.deleteMany({ id: { $in: ids } });
      return ReS(res, SUCCESS_CODE, "Bulk delete completed", { deleted: ids });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getLeadById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      const lead = await leadRepository.findById(Number(id));
      if (!lead) return ReE(res, RESOURCE_NOT_FOUND, "Lead not found");
      return ReS(res, SUCCESS_CODE, "Lead fetched successfully", lead);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new LeadsController();

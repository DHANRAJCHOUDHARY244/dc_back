import XLSX from "xlsx";
import { Response, Request } from "express";
import { leadRepository } from "@repositories";
import { ReS, ReE } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, RESOURCE_NOT_FOUND } from "@constants/serverCode";
import { AuthenticatedRequest, DocumentsAuthenticatedRequest } from "@constants/common.interface";
import {
  BILL_RANGES,
  BEST_TIMES,
  CURRENT_SYSTEMS,
  INTERESTED_PRODUCTS,
  LEAD_SCORE_TIERS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  OWNERSHIP_TYPES,
  PREFERRED_CONTACTS,
  PROPERTY_TYPES,
  ROOF_TYPES,
  computeLeadScore,
} from "@constants/leadPipeline.constants";
import {
  assignLeadsRoundRobin,
  createEnquiryLead,
  getLeadManagementDashboard,
  isLeadAdminRole,
  logLeadCall,
  qualifyLead,
  runLeadSupervisor,
  suggestNextBestAction,
  updateLeadStatus,
} from "@services/leadWorkflow.service";

class LeadsController {
  fixedKeys = ["lead_id", "date", "time", "name", "phone", "email", "address", "note", "remark"];

  async getPipelineMeta(_req: Request, res: Response) {
    try {
      return ReS(res, SUCCESS_CODE, "Lead pipeline metadata", {
        statuses: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] || s })),
        sources: [...LEAD_SOURCES],
        score_tiers: [...LEAD_SCORE_TIERS],
        property_types: [...PROPERTY_TYPES],
        ownership: [...OWNERSHIP_TYPES],
        bill_ranges: [...BILL_RANGES],
        current_systems: [...CURRENT_SYSTEMS],
        interested_in: [...INTERESTED_PRODUCTS],
        roof_types: [...ROOF_TYPES],
        best_times: [...BEST_TIMES],
        preferred_contacts: [...PREFERRED_CONTACTS],
      });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

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
        clean.source = "CSV Import";
        clean.status = "NEW_LEAD";
        clean.score = 20;
        clean.score_tier = "COLD";
        clean.timeline = [
          {
            type: "enquiry",
            title: "CSV Import",
            detail: "Lead imported from spreadsheet",
            at: new Date(),
          },
        ];
        clean.call_logs = [];
        clean.ai_messages = [];
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
      const body = req.body || {};
      const result = await createEnquiryLead({
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        postcode: body.postcode,
        state: body.state,
        source: body.source || "Manual",
        property_type: body.property_type,
        ownership: body.ownership,
        bill_range: body.bill_range,
        current_system: body.current_system,
        interested_in: body.interested_in,
        roof_type: body.roof_type,
        best_time_to_call: body.best_time_to_call,
        preferred_contact: body.preferred_contact,
        language: body.language,
        note: body.note || body.remark,
      });

      if (body.remark || body.uploaded_by || req.user?.id) {
        await leadRepository.updateMany(
          { id: (result.lead as any).id },
          {
            $set: {
              remark: body.remark || "",
              uploaded_by: req.user?.id || body.uploaded_by || null,
            },
          },
        );
      }

      return ReS(res, SUCCESS_CODE, "Lead created", {
        ...(result.lead as any)?.toObject?.() ?? result.lead,
        welcome_message: result.welcome_message,
        thanks_message: result.thanks_message,
        duplicates: result.duplicates,
        next_best_action: result.next_best_action,
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async publicEnquiry(req: Request, res: Response) {
    try {
      const body = req.body || {};
      if (!body.name) return ReE(res, SERVER_ERROR_CODE, "name is required");
      const result = await createEnquiryLead({
        name: body.name,
        phone: body.phone || body.mobile,
        email: body.email,
        address: body.address,
        postcode: body.postcode,
        state: body.state || body.subsurb,
        source: body.source || "Website",
        property_type: body.property_type || body.select_property_type,
        ownership: body.ownership,
        bill_range: body.bill_range,
        current_system: body.current_system,
        interested_in: body.interested_in,
        roof_type: body.roof_type,
        best_time_to_call: body.best_time_to_call,
        preferred_contact: body.preferred_contact || "WhatsApp",
        language: body.language,
        note: body.note || body.message,
        cf_id: body.cf_id,
        popup_id: body.popup_id,
      });
      return ReS(res, SUCCESS_CODE, "Enquiry received", {
        lead_id: (result.lead as any)?.id,
        welcome_message: result.welcome_message,
        thanks_message: result.thanks_message,
        score: (result.lead as any)?.score,
        score_tier: (result.lead as any)?.score_tier,
        duplicates: result.duplicates,
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async list(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        phone,
        email,
        name,
        status,
        source,
        score_tier,
        owner_id,
        unassigned,
      } = req.query as any;

      const filter: Record<string, unknown> = {};
      const user = req.user || {};
      const isAdmin = isLeadAdminRole(user.role);

      if (!isAdmin) {
        filter.owner_id = user.id;
      } else if (owner_id) {
        filter.owner_id = Number(owner_id);
      } else if (String(unassigned) === "true") {
        filter.$or = [{ owner_id: null }, { owner_id: { $exists: false } }];
      }

      if (search) filter.name = { $regex: search, $options: "i" };
      if (phone) filter.phone = phone;
      if (email) filter.email = email;
      if (name) filter.name = { $regex: name, $options: "i" };
      if (status) filter.status = status;
      if (source) filter.source = source;
      if (score_tier) filter.score_tier = score_tier;

      const { rows, count } = await leadRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { created_at: -1 },
        populate: { path: "owner", select: "id name" },
      });

      const leads = (rows as any[]).map((l) => {
        const plain = typeof l.toObject === "function" ? l.toObject() : l;
        return { ...plain, next_best_action: suggestNextBestAction(plain) };
      });

      return ReS(res, SUCCESS_CODE, "Leads fetched", {
        leads,
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
      const body = { ...(req.body || {}) };
      delete body.id;
      delete body._id;

      if (body.bill_range || body.interested_in || body.ownership || body.property_type || body.state) {
        const existing: any = await leadRepository.findById(Number(id), { lean: true });
        if (existing) {
          const { score, tier } = computeLeadScore({
            bill_range: body.bill_range ?? existing.bill_range,
            interested_in: body.interested_in ?? existing.interested_in,
            ownership: body.ownership ?? existing.ownership,
            property_type: body.property_type ?? existing.property_type,
            state: body.state ?? existing.state,
          });
          body.score = score;
          body.score_tier = tier;
        }
      }

      if (body.status) {
        await updateLeadStatus(Number(id), body.status, {
          actorId: req.user?.id,
          remark: body.status_remark,
          next_follow_up_at: body.next_follow_up_at,
        });
        delete body.status;
        delete body.status_remark;
      }

      if (Object.keys(body).length) {
        await leadRepository.updateById(Number(id), { $set: body });
      }
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
      const lead: any = await leadRepository.findById(Number(id), {
        populate: { path: "owner", select: "id name email mobile_no" },
      });
      if (!lead) return ReE(res, RESOURCE_NOT_FOUND, "Lead not found");
      const plain = typeof lead.toObject === "function" ? lead.toObject() : lead;
      return ReS(res, SUCCESS_CODE, "Lead fetched successfully", {
        ...plain,
        next_best_action: suggestNextBestAction(plain),
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async dashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await getLeadManagementDashboard({
        id: Number(req.user?.id),
        role: String(req.user?.role || ""),
      });
      return ReS(res, SUCCESS_CODE, "Lead management dashboard", data);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async logCall(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      const lead = await logLeadCall(Number(id), {
        connected: !!req.body?.connected,
        duration_seconds: req.body?.duration_seconds,
        remark: req.body?.remark,
        next_follow_up_at: req.body?.next_follow_up_at,
        status: req.body?.status,
        actorId: req.user?.id,
      });
      return ReS(res, SUCCESS_CODE, "Call logged", {
        lead,
        next_best_action: suggestNextBestAction(lead),
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async assign(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isLeadAdminRole(req.user?.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Only managers/admins can assign leads");
      }
      const result = await assignLeadsRoundRobin({
        leadIds: req.body?.lead_ids,
        salespersonIds: req.body?.salesperson_ids || [],
        actorId: req.user?.id,
      });
      return ReS(res, SUCCESS_CODE, "Leads assigned", result);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      const lead = await updateLeadStatus(Number(id), req.body?.status, {
        actorId: req.user?.id,
        remark: req.body?.remark,
        next_follow_up_at: req.body?.next_follow_up_at,
      });
      return ReS(res, SUCCESS_CODE, "Status updated", {
        lead,
        next_best_action: suggestNextBestAction(lead),
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async qualify(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      const result = await qualifyLead(Number(id), { ...req.body, actorId: req.user?.id });
      return ReS(res, SUCCESS_CODE, "Lead qualified", result);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async runSupervisor(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isLeadAdminRole(req.user?.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Only managers/admins can run supervisor");
      }
      const result = await runLeadSupervisor({
        hours: Number(req.body?.hours) || 24,
        reassign: !!req.body?.reassign,
      });
      return ReS(res, SUCCESS_CODE, "Supervisor run complete", result);
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new LeadsController();

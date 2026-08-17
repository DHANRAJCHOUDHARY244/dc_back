import XLSX from "xlsx";
import { Response, Request } from "express";
import { ReS, ReE } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, RESOURCE_NOT_FOUND } from "@constants/serverCode";
import { AuthenticatedRequest, DocumentsAuthenticatedRequest } from "@constants/common.interface";
import {
  AGENT_AVAILABILITY,
  BILL_RANGES,
  BEST_TIMES,
  CURRENT_SYSTEMS,
  CUSTOMER_TYPES,
  DISTRIBUTION_MODES,
  INTERESTED_PRODUCTS,
  KANBAN_COLUMNS,
  LEAD_NOTE_TYPES,
  LEAD_SCORE_TIERS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  LEAD_TRANSFER_REASONS,
  OWNERSHIP_TYPES,
  PREFERRED_CONTACTS,
  PROPERTY_TYPES,
  PURCHASE_TIMEFRAMES,
  ROOF_TYPES,
  computeLeadScore,
} from "@constants/leadPipeline.constants";
import {
  addLeadNote,
  assignLeadsRoundRobin,
  createEnquiryLead,
  enrichLead,
  findDuplicateLeads,
  getLeadManagementDashboard,
  getSourceAnalytics,
  logLeadCall,
  qualifyLead,
  resolveDuplicate,
  runLeadCommand,
  runLeadSupervisor,
  suggestNextBestAction,
  transferLead,
  updateLeadStatus,
} from "@services/leadWorkflow.service";
import { applyLeadScope, getLeadAccess } from "@services/leadAccess.service";
import {
  autoAssignLead,
  getDistributionSettings,
  listSalesUsers,
  saveDistributionSettings,
} from "@services/leadDistribution.service";
import {
  leadAgentRepository,
  leadRepository,
  leadServiceAreaRepository,
} from "@repositories";

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
        transfer_reasons: [...LEAD_TRANSFER_REASONS],
        note_types: [...LEAD_NOTE_TYPES],
        availability: [...AGENT_AVAILABILITY],
        distribution_modes: [...DISTRIBUTION_MODES],
        kanban: KANBAN_COLUMNS,
        customer_types: [...CUSTOMER_TYPES],
        purchase_timeframes: [...PURCHASE_TIMEFRAMES],
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
        created_by: req.user?.id || null,
        suburb: body.suburb,
        country: body.country,
        campaign_name: body.campaign_name,
        ad_name: body.ad_name,
        landing_page: body.landing_page,
        solar_requirement: body.solar_requirement,
        battery_requirement: body.battery_requirement,
        solar_system_size: body.solar_system_size,
        battery_size: body.battery_size,
        existing_inverter: body.existing_inverter,
        customer_type: body.customer_type,
        purchase_timeframe: body.purchase_timeframe,
        installation_location: body.installation_location,
        estimated_system_value: body.estimated_system_value,
        estimated_sales_value: body.estimated_sales_value,
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
        bucket,
        state,
        suburb,
        postcode,
        team_leader_id,
        q,
        scope,
      } = req.query as any;

      const filter: Record<string, unknown> = { merged_into_id: null };
      const user = req.user || {};
      const access = await getLeadAccess(user);
      if (String(scope) === "mine") {
        filter.owner_id = user.id;
      } else {
        applyLeadScope(filter, access);
      }
      if (access.scope === "admin" && owner_id) filter.owner_id = Number(owner_id);
      if (String(unassigned) === "true") {
        filter.$or = [{ owner_id: null }, { owner_id: { $exists: false } }];
        delete filter.owner_id;
      }

      const text = q || search;
      if (text) {
        const rx = { $regex: String(text), $options: "i" };
        filter.$or = [
          { name: rx },
          { phone: rx },
          { email: rx },
          { public_id: rx },
          { address: rx },
          { postcode: rx },
          { campaign_name: rx },
        ];
      }
      if (phone) filter.phone = phone;
      if (email) filter.email = email;
      if (name) filter.name = { $regex: name, $options: "i" };
      if (status) filter.status = status;
      if (source) filter.source = source;
      if (score_tier) filter.score_tier = score_tier;
      if (state) filter.state = { $regex: state, $options: "i" };
      if (suburb) filter.suburb = { $regex: suburb, $options: "i" };
      if (postcode) filter.postcode = postcode;
      if (team_leader_id) filter.team_leader_id = Number(team_leader_id);

      if (bucket === "untouched") {
        filter.last_contacted_at = null;
        filter.status = { $in: ["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED"] };
      } else if (bucket === "hot") {
        filter.score_tier = { $in: ["HOT", "VERY_HOT"] };
      } else if (bucket === "overdue") {
        filter.next_follow_up_at = { $lt: new Date() };
      } else if (bucket === "followups_today") {
        const s = new Date();
        s.setHours(0, 0, 0, 0);
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        filter.next_follow_up_at = { $gte: s, $lte: e };
      } else if (bucket === "transferred") {
        filter["transfers.0"] = { $exists: true };
      }

      const { rows, count } = await leadRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { created_at: -1 },
        populate: [
          { path: "owner", select: "id name" },
          { path: "team_leader", select: "id name" },
        ],
      });

      const leads = (rows as any[]).map((l) => {
        const plain = typeof l.toObject === "function" ? l.toObject() : l;
        return enrichLead(plain);
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
        populate: [
          { path: "owner", select: "id name email mobile_no" },
          { path: "team_leader", select: "id name" },
        ],
      });
      if (!lead) return ReE(res, RESOURCE_NOT_FOUND, "Lead not found");
      const plain = typeof lead.toObject === "function" ? lead.toObject() : lead;
      if (!plain.opened_at) {
        await leadRepository.updateMany(
          { id: Number(id) },
          {
            $set: {
              opened_at: new Date(),
              timeline: [
                ...(Array.isArray(plain.timeline) ? plain.timeline : []),
                { type: "opened", title: "Agent Opened Lead", at: new Date(), by: req.user?.id || null },
              ],
            },
          },
        );
      }
      const duplicates = await findDuplicateLeads({
        phone: plain.phone,
        email: plain.email,
        name: plain.name,
        address: plain.address,
        excludeId: plain.id,
      });
      return ReS(res, SUCCESS_CODE, "Lead fetched successfully", {
        ...enrichLead(plain),
        duplicates,
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
        role_id: req.user?.role_id,
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
      const access = await getLeadAccess(req.user || {});
      if (!access.is_admin && !access.is_team_leader) {
        return ReE(res, SERVER_ERROR_CODE, "Only managers/admins can assign leads");
      }
      const mode = req.body?.mode || "round_robin";
      if (mode === "ai_smart") {
        let leads: any[] = [];
        if (req.body?.lead_ids?.length) {
          leads = await leadRepository.find({ id: { $in: req.body.lead_ids.map(Number) } }, { lean: true });
        } else {
          leads = await leadRepository.find(
            {
              $or: [{ owner_id: null }, { owner_id: { $exists: false } }],
              status: { $in: ["NEW_LEAD", "AI_QUALIFIED"] },
            },
            { lean: true, limit: 100, sort: { created_at: 1 } },
          );
        }
        const results = [];
        for (const lead of leads) {
          results.push(await autoAssignLead(lead, req.user?.id));
        }
        return ReS(res, SUCCESS_CODE, "Leads assigned", {
          assigned_total: results.filter((r) => r.assigned).length,
          results,
        });
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
      const access = await getLeadAccess(req.user || {});
      if (!access.is_admin && !access.is_team_leader) {
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

  async addNote(req: AuthenticatedRequest, res: Response) {
    try {
      const lead = await addLeadNote(Number(req.params.id), {
        type: req.body?.type,
        body: req.body?.body || req.body?.note,
        actorId: req.user?.id,
        actorName: req.user?.name,
      });
      return ReS(res, SUCCESS_CODE, "Note added", enrichLead(lead));
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async transfer(req: AuthenticatedRequest, res: Response) {
    try {
      const lead = await transferLead(Number(req.params.id), {
        to_user_id: Number(req.body?.to_user_id),
        reason: req.body?.reason,
        note: req.body?.note,
        actorId: req.user?.id,
        actorName: req.user?.name,
      });
      return ReS(res, SUCCESS_CODE, "Lead transferred", enrichLead(lead));
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async duplicates(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await resolveDuplicate(Number(req.params.id), {
        action: req.body?.action,
        target_id: Number(req.body?.target_id),
        actorId: req.user?.id,
      });
      return ReS(res, SUCCESS_CODE, "Duplicate resolved", enrichLead(result));
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async analytics(req: AuthenticatedRequest, res: Response) {
    try {
      const access = await getLeadAccess(req.user || {});
      const filter: Record<string, unknown> = { merged_into_id: null };
      applyLeadScope(filter, access);
      const sources = await getSourceAnalytics(filter);
      return ReS(res, SUCCESS_CODE, "Lead analytics", { sources });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async command(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await runLeadCommand(
        { id: Number(req.user?.id), role: String(req.user?.role || "") },
        String(req.body?.prompt || ""),
      );
      if (req.body?.confirm && result.action === "distribute_new") {
        const access = await getLeadAccess(req.user || {});
        const filter: Record<string, unknown> = {
          $or: [{ owner_id: null }, { owner_id: { $exists: false } }],
          status: { $in: ["NEW_LEAD", "AI_QUALIFIED"] },
        };
        applyLeadScope(filter, access);
        const leads: any[] = await leadRepository.find(filter, { lean: true, limit: 50 });
        let n = 0;
        for (const lead of leads) {
          const r = await autoAssignLead(lead, req.user?.id);
          if (r.assigned) n += 1;
        }
        return ReS(res, SUCCESS_CODE, "Distributed", { answer: `Assigned ${n} new lead(s).`, assigned: n });
      }
      if (req.body?.confirm && result.action === "reassign_inactive") {
        const r = await runLeadSupervisor({ hours: 24, reassign: true });
        return ReS(res, SUCCESS_CODE, "Reassigned", { answer: `Reassignment run complete. ${r.reassigned} moved.`, ...r });
      }
      return ReS(res, SUCCESS_CODE, "Command result", result);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await getDistributionSettings();
      const areas = await leadServiceAreaRepository.find({}, { lean: true, sort: { name: 1 } });
      const agents = await leadAgentRepository.find({}, { lean: true, populate: { path: "user", select: "id name" } });
      const salespeople = await listSalesUsers();
      return ReS(res, SUCCESS_CODE, "Distribution settings", { settings, areas, agents, salespeople });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async saveSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const access = await getLeadAccess(req.user || {});
      if (!access.is_admin) return ReE(res, SERVER_ERROR_CODE, "Admin only");
      const settings = await saveDistributionSettings(req.body || {});
      return ReS(res, SUCCESS_CODE, "Settings saved", settings);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async saveArea(req: AuthenticatedRequest, res: Response) {
    try {
      const access = await getLeadAccess(req.user || {});
      if (!access.is_admin && !access.is_team_leader) return ReE(res, SERVER_ERROR_CODE, "Not allowed");
      const body = req.body || {};
      if (body.id) {
        await leadServiceAreaRepository.updateById(Number(body.id), { $set: body });
        return ReS(res, SUCCESS_CODE, "Area updated", await leadServiceAreaRepository.findById(Number(body.id), { lean: true }));
      }
      const area = await leadServiceAreaRepository.create({
        name: body.name,
        states: body.states || [],
        suburbs: body.suburbs || [],
        postcodes: body.postcodes || [],
        team_leader_id: body.team_leader_id || null,
        salesperson_ids: body.salesperson_ids || [],
        active: body.active !== false,
      });
      return ReS(res, SUCCESS_CODE, "Area created", area);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async saveAgent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.body?.user_id || req.user?.id);
      const access = await getLeadAccess(req.user || {});
      if (!access.is_admin && !access.is_team_leader && userId !== Number(req.user?.id)) {
        return ReE(res, SERVER_ERROR_CODE, "Not allowed");
      }
      const existing: any = await leadAgentRepository.findOne({ user_id: userId }, { lean: true });
      const patch = {
        user_id: userId,
        availability: req.body?.availability,
        max_daily_leads: req.body?.max_daily_leads,
        max_active_leads: req.body?.max_active_leads,
        max_follow_ups: req.body?.max_follow_ups,
        max_concurrent_opportunities: req.body?.max_concurrent_opportunities,
        product_expertise: req.body?.product_expertise,
        service_states: req.body?.service_states,
        service_postcodes: req.body?.service_postcodes,
        languages: req.body?.languages,
        working_hours_start: req.body?.working_hours_start,
        working_hours_end: req.body?.working_hours_end,
        do_not_assign: req.body?.availability === "Do Not Assign Leads" || !!req.body?.do_not_assign,
        notes: req.body?.notes,
      };
      Object.keys(patch).forEach((k) => (patch as any)[k] === undefined && delete (patch as any)[k]);
      if (existing) {
        await leadAgentRepository.updateById(existing.id, { $set: patch });
        return ReS(res, SUCCESS_CODE, "Availability saved", await leadAgentRepository.findById(existing.id, { lean: true }));
      }
      const created = await leadAgentRepository.create(patch);
      return ReS(res, SUCCESS_CODE, "Availability saved", created);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }

  async ingestWebhook(req: Request, res: Response) {
    try {
      const channel = String(req.params.channel || "generic").toLowerCase();
      if (req.method === "GET" && channel === "meta") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token === (process.env.META_LEAD_VERIFY_TOKEN || process.env.LEAD_WEBHOOK_SECRET)) {
          return res.status(200).send(challenge);
        }
        return res.status(403).send("Forbidden");
      }
      const secret = process.env.LEAD_WEBHOOK_SECRET;
      if (secret && req.headers["x-lead-secret"] && req.headers["x-lead-secret"] !== secret) {
        return ReE(res, SERVER_ERROR_CODE, "Invalid webhook secret");
      }
      const body: any = req.body || {};
      let mapped: any = {
        name: body.name || body.full_name || "Website Lead",
        phone: body.phone || body.mobile || body.phone_number,
        email: body.email,
        address: body.address,
        suburb: body.suburb || body.city,
        postcode: body.postcode || body.zip,
        state: body.state,
        source: body.source,
        campaign_name: body.campaign_name || body.campaign,
        ad_name: body.ad_name,
        landing_page: body.landing_page || body.page_url,
        note: body.note || body.message,
        external_id: body.leadgen_id || body.lead_id || body.id,
        utm_source: body.utm_source,
        utm_campaign: body.utm_campaign,
        utm_medium: body.utm_medium,
      };
      if (channel === "meta") {
        const value = body?.entry?.[0]?.changes?.[0]?.value || body;
        const fields = Array.isArray(value.field_data) ? value.field_data : [];
        const pick = (n: string) => fields.find((f: any) => String(f.name).toLowerCase().includes(n))?.values?.[0];
        mapped = {
          ...mapped,
          name: pick("name") || pick("full") || mapped.name,
          phone: pick("phone") || mapped.phone,
          email: pick("email") || mapped.email,
          source: "Facebook Ads",
          campaign_name: value.campaign_name || mapped.campaign_name,
          ad_name: value.ad_name || mapped.ad_name,
          external_id: value.leadgen_id || mapped.external_id,
        };
      }
      if (channel === "google") {
        const cols = Array.isArray(body.user_column_data) ? body.user_column_data : [];
        const pick = (n: string) => cols.find((f: any) => String(f.column_name).toLowerCase().includes(n))?.string_value;
        mapped = {
          ...mapped,
          name: pick("name") || mapped.name,
          phone: pick("phone") || mapped.phone,
          email: pick("email") || mapped.email,
          source: "Google Lead Forms",
          campaign_name: body.campaign_id || mapped.campaign_name,
          external_id: body.lead_id || mapped.external_id,
        };
      }
      if (channel === "whatsapp") mapped.source = mapped.source || "WhatsApp";
      if (!mapped.source) mapped.source = channel === "google" ? "Google Ads" : "Website";
      const result = await createEnquiryLead(mapped);
      return ReS(res, SUCCESS_CODE, "Lead ingested", {
        lead_id: (result.lead as any)?.id,
        public_id: (result.lead as any)?.public_id,
        duplicates: result.duplicates,
        score: (result.lead as any)?.score,
      });
    } catch (error: any) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new LeadsController();

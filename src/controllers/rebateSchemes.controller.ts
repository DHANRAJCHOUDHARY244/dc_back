import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { rebateSchemeRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import {
  evaluateRebates,
  seedDefaultRebateSchemes,
  type RebateEngineProducts,
  type RebateEngineSettings,
  type RebateEngineSite,
} from "@services/rebateEngine.service";
import { Response } from "express";

function sanitizeSchemeBody(body: any) {
  if (!body || typeof body !== "object") return null;
  const code = String(body.code || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!code && !body.id) return null;
  return {
    code: code || undefined,
    name: String(body.name || "").trim(),
    jurisdiction: body.jurisdiction === "federal" ? "federal" : "state",
    state: String(body.state || "").toUpperCase(),
    product_type: ["solar", "battery", "hot_water", "vpp", "any"].includes(body.product_type)
      ? body.product_type
      : "any",
    customer_type: ["residential", "commercial", "any"].includes(body.customer_type)
      ? body.customer_type
      : "any",
    start_date: body.start_date ? new Date(body.start_date) : null,
    end_date: body.end_date ? new Date(body.end_date) : null,
    active: body.active !== false,
    rebate_type: [
      "fixed",
      "per_kwh",
      "per_stc",
      "percent",
      "battery_stc_bands",
      "solar_stc",
    ].includes(body.rebate_type)
      ? body.rebate_type
      : "fixed",
    amount: Number(body.amount) || 0,
    max_amount: Number(body.max_amount) || 0,
    min_system_kw: Number(body.min_system_kw) || 0,
    max_system_kw: Number(body.max_system_kw) || 0,
    min_battery_kwh: Number(body.min_battery_kwh) || 0,
    max_battery_kwh: Number(body.max_battery_kwh) || 0,
    vpp_required: !!body.vpp_required,
    retailer_required: String(body.retailer_required || ""),
    stackable: body.stackable !== false,
    is_loan: !!body.is_loan,
    requires_confirmation: body.requires_confirmation !== false,
    eligibility_text: String(body.eligibility_text || ""),
    explanation: String(body.explanation || ""),
    rules: body.rules && typeof body.rules === "object" ? body.rules : {},
    sort_order: Number(body.sort_order) || 100,
  };
}

class RebateSchemesController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      let rows = await rebateSchemeRepository.find(
        {},
        { sort: { sort_order: 1, id: 1 }, lean: true, limit: 1 },
      );
      if (!rows?.length) {
        await seedDefaultRebateSchemes();
      }
      const filter: Record<string, unknown> = {};
      if (req.query.state) filter.state = String(req.query.state).toUpperCase();
      if (req.query.active === "true") filter.active = true;
      if (req.query.active === "false") filter.active = false;
      if (req.query.jurisdiction) filter.jurisdiction = String(req.query.jurisdiction);
      rows = await rebateSchemeRepository.find(filter, {
        sort: { sort_order: 1, id: 1 },
        lean: true,
      });
      return ReS(res, SUCCESS_CODE, "Rebate schemes fetched.", rows);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to list rebate schemes.");
    }
  }

  async getOne(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const row = await rebateSchemeRepository.findById(id, { lean: true });
      if (!row) return ReE(res, BAD_REQUEST_CODE, "Scheme not found.");
      return ReS(res, SUCCESS_CODE, "Rebate scheme fetched.", row);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch rebate scheme.");
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const data = sanitizeSchemeBody(req.body);
      if (!data?.code || !data.name) {
        return ReE(res, BAD_REQUEST_CODE, "code and name are required.");
      }
      const exists = await rebateSchemeRepository.findOne({ code: data.code });
      if (exists) return ReE(res, BAD_REQUEST_CODE, "Scheme code already exists.");
      const created = await rebateSchemeRepository.create({
        ...data,
        created_by: req.user?.id,
      });
      return ReS(res, SUCCESS_CODE, "Rebate scheme created.", created);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to create rebate scheme.");
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const data = sanitizeSchemeBody({ ...req.body, code: req.body.code || "x" });
      if (!data) return ReE(res, BAD_REQUEST_CODE, "Invalid body.");
      const { code: _ignored, ...rest } = data;
      const patch: Record<string, unknown> = { ...rest };
      if (req.body.code) patch.code = String(req.body.code).trim().toLowerCase();
      const updated = await rebateSchemeRepository.updateById(id, {
        $set: { ...patch, updated_by: req.user?.id },
      });
      if (!updated) return ReE(res, BAD_REQUEST_CODE, "Scheme not found.");
      return ReS(res, SUCCESS_CODE, "Rebate scheme updated.", updated);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to update rebate scheme.");
    }
  }

  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const deleted = await rebateSchemeRepository.softDeleteById(id);
      if (!deleted) return ReE(res, BAD_REQUEST_CODE, "Scheme not found.");
      return ReS(res, SUCCESS_CODE, "Rebate scheme deleted.", deleted);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete rebate scheme.");
    }
  }

  async seed(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await seedDefaultRebateSchemes();
      try {
        const { seedRebateSchemesPermission } = await import("src/data/dataInserter");
        await seedRebateSchemesPermission();
      } catch (permErr) {
        console.warn("Rebate permission seed skipped", permErr);
      }
      return ReS(res, SUCCESS_CODE, "Rebate schemes seeded.", result);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to seed rebate schemes.");
    }
  }

  async evaluate(req: AuthenticatedRequest, res: Response) {
    try {
      const site = (req.body?.site || {}) as RebateEngineSite;
      const products = (req.body?.products || {}) as RebateEngineProducts;
      const settings = (req.body?.settings || {}) as RebateEngineSettings;
      const result = await evaluateRebates(site, products, settings);
      return ReS(res, SUCCESS_CODE, "Rebates evaluated.", result);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to evaluate rebates.");
    }
  }
}

export default new RebateSchemesController();

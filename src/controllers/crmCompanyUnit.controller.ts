import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { crmCompanyUnitRepository } from "@repositories";
import {
	ensureDefaultCrmCompanyUnits,
	getCompanyUnitById,
	listActiveCompanyUnits,
	mapUnitToPublicBranding,
} from "@services/crmCompanyUnit.service";
import { Response } from "express";

class CrmCompanyUnitController {
	async listForSelector(_req: AuthenticatedRequest, res: Response) {
		try {
			const rows = await listActiveCompanyUnits();
			const data = rows.map((u: Record<string, unknown>) => ({
				id: u.id,
				company_name: u.company_name,
				trading_name: u.trading_name,
				state_code: u.state_code,
				logo_url: u.logo_url,
				abn: u.abn,
			}));
			return ReS(res, SUCCESS_CODE, "Companies fetched.", data);
		} catch (err) {
			return ReE(res, SERVER_ERROR_CODE, err);
		}
	}

	async getPublicBranding(req: AuthenticatedRequest, res: Response) {
		try {
			res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
			const id = Number(req.query.company_unit_id || req.query.companyUnitId);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "company_unit_id is required");
			const unit = await getCompanyUnitById(id);
			if (!unit) return ReE(res, BAD_REQUEST_CODE, "Company not found");
			return ReS(res, SUCCESS_CODE, "Company config fetched.", mapUnitToPublicBranding(unit as Record<string, unknown>));
		} catch (err) {
			return ReE(res, SERVER_ERROR_CODE, err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const unit = await getCompanyUnitById(Number(req.params.id));
			if (!unit) return ReE(res, BAD_REQUEST_CODE, "Company not found");
			return ReS(res, SUCCESS_CODE, "Company profile fetched.", unit);
		} catch (err) {
			return ReE(res, SERVER_ERROR_CODE, err);
		}
	}

	async updateById(req: AuthenticatedRequest, res: Response) {
		try {
			await ensureDefaultCrmCompanyUnits();
			const id = Number(req.params.id);
			const existing = await crmCompanyUnitRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Company not found");
			const body = req.body ?? {};
			const updated = await crmCompanyUnitRepository.updateById(id, { $set: body });
			return ReS(res, SUCCESS_CODE, "Company updated.", updated);
		} catch (err) {
			return ReE(res, SERVER_ERROR_CODE, err);
		}
	}
}

export default new CrmCompanyUnitController();

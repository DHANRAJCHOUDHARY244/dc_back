import { Request, Response } from "express";
import { ReE, ReS } from "@services/generalHelper.service";
import { FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "../constants/serverCode";
import {
	backfillActiveQuotes,
	canManageSla,
	ensureSlaSeeds,
	evaluateOpenRuns,
	getAlertsSummary,
	getQuoteSlaTimeline,
	getSlaCountsByStage,
	listDelayedJobs,
	listDelayReasons,
	listStageConfigs,
	resolveDelay,
	setDelayReason,
	upsertStageConfigs,
} from "@services/sla.service";

type AuthReq = Request & { user?: { id?: number; role?: string } };

class SlaController {
	private guard(req: AuthReq, res: Response) {
		if (!canManageSla(req.user?.role)) {
			ReE(res, FORBIDDEN_CODE, "SLA management access required");
			return false;
		}
		return true;
	}

	async seed(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			await ensureSlaSeeds();
			const result = await backfillActiveQuotes();
			return ReS(res, SUCCESS_CODE, "SLA seeds ready", result);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getSettings(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const stages = await listStageConfigs();
			return ReS(res, SUCCESS_CODE, "OK", { stages });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateSettings(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const stages = Array.isArray(req.body?.stages) ? req.body.stages : [];
			const updated = await upsertStageConfigs(stages, req.user?.id);
			return ReS(res, SUCCESS_CODE, "SLA settings updated", { stages: updated });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async delayReasons(_req: AuthReq, res: Response) {
		try {
			const reasons = await listDelayReasons();
			return ReS(res, SUCCESS_CODE, "OK", reasons);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async alertsSummary(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const summary = await getAlertsSummary();
			return ReS(res, SUCCESS_CODE, "OK", summary);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async delayedJobs(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const q = { ...req.query, ...req.body };
			const rows = await listDelayedJobs(q);
			return ReS(res, SUCCESS_CODE, "OK", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async quoteTimeline(req: AuthReq, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, SERVER_ERROR_CODE, "Invalid quote id");
			const data = await getQuoteSlaTimeline(id);
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async setReason(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const runId = Number(req.params.id);
			const code = String(req.body?.delay_reason_code || "").trim();
			if (!code) return ReE(res, SERVER_ERROR_CODE, "delay_reason_code is required");
			const updated = await setDelayReason(runId, {
				delay_reason_code: code,
				delay_explanation: req.body?.delay_explanation,
				responsible_user_id: req.body?.responsible_user_id,
				actorId: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Delay reason saved", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async resolve(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const runId = Number(req.params.id);
			const updated = await resolveDelay(runId, {
				resolution_notes: req.body?.resolution_notes,
				actorId: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Delay resolved", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async stageCounts(req: AuthReq, res: Response) {
		try {
			const data = await getSlaCountsByStage();
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async evaluate(req: AuthReq, res: Response) {
		try {
			if (!this.guard(req, res)) return;
			const result = await evaluateOpenRuns();
			return ReS(res, SUCCESS_CODE, "Evaluated", result);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}
}

export default new SlaController();

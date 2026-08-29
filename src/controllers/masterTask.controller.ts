import { Request, Response } from "express";
import { ReE, ReS } from "@services/generalHelper.service";
import {
	BAD_REQUEST_CODE,
	FORBIDDEN_CODE,
	RESOURCE_NOT_FOUND,
	SERVER_ERROR_CODE,
	SUCCESS_CODE,
} from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
	addTaskComment,
	canManageMasterTasks,
	completeFollowUp,
	createFollowUp,
	createMasterTask,
	ensureMasterTaskSeeds,
	evaluateTaskEscalations,
	getTaskSummary,
	listEscalationRules,
	listFollowUps,
	listMasterTasks,
	listTaskTypes,
	markMissedFollowUps,
	upsertEscalationRules,
} from "@services/masterTask.service";
import { notifyMasterTaskBadgeChanged } from "@services/badgeNotify.service";
import { taskRepository } from "@repositories";
import { MasterTaskStatus } from "@constants/masterTask.constants";

class MasterTaskController {
	async seed(req: AuthenticatedRequest, res: Response) {
		try {
			await ensureMasterTaskSeeds();
			return ReS(res, SUCCESS_CODE, "Master task seeds ready");
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const task = await createMasterTask(req.body || {}, req.user.id);
			return ReS(res, SUCCESS_CODE, "Task created", task);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message || "Unable to create task");
		}
	}

	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const body = { ...(req.body || {}), ...(req.query || {}) };
			const data = await listMasterTasks(body, { id: req.user.id, role: req.user.role });
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async summary(req: AuthenticatedRequest, res: Response) {
		try {
			const data = await getTaskSummary({ id: req.user.id, role: req.user.role });
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async types(_req: Request, res: Response) {
		try {
			const data = await listTaskTypes();
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async escalationRules(req: AuthenticatedRequest, res: Response) {
		try {
			if (!canManageMasterTasks(req.user.role)) {
				return ReE(res, FORBIDDEN_CODE, "Admin only");
			}
			const data = await listEscalationRules();
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async saveEscalationRules(req: AuthenticatedRequest, res: Response) {
		try {
			if (!canManageMasterTasks(req.user.role)) {
				return ReE(res, FORBIDDEN_CODE, "Admin only");
			}
			const rows = Array.isArray(req.body?.rules) ? req.body.rules : [];
			const data = await upsertEscalationRules(rows, req.user.id);
			return ReS(res, SUCCESS_CODE, "Saved", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateStatus(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const status = String(req.body?.status || "").toUpperCase();
			const task: any = await taskRepository.findOne({ id }, { lean: true });
			if (!task) return ReE(res, RESOURCE_NOT_FOUND, "Task not found");

			const $set: any = {
				status,
				progress: [
					...(task.progress || []),
					{
						type: "STATUS",
						message: `Status → ${status}`,
						updated_by: req.user.id,
						updated_at: new Date(),
					},
				],
			};
			if (
				status === MasterTaskStatus.COMPLETED ||
				status === MasterTaskStatus.DONE ||
				status === "DONE"
			) {
				$set.status = MasterTaskStatus.COMPLETED;
				$set.closing_date = new Date();
				$set.closing_message = req.body?.closing_message || "";
			}
			if (req.body?.delay_party) $set.delay_party = req.body.delay_party;

			await taskRepository.updateMany({ id }, { $set });
			const updated = await taskRepository.findOne(
				{ id },
				{ lean: true, populate: [{ path: "user", select: "id name" }] },
			);
			notifyMasterTaskBadgeChanged();
			return ReS(res, SUCCESS_CODE, "Updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async comment(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const message = String(req.body?.message || "").trim();
			if (!message) return ReE(res, BAD_REQUEST_CODE, "message required");
			const updated = await addTaskComment(id, message, req.user.id);
			return ReS(res, SUCCESS_CODE, "Comment added", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async createFollowUp(req: AuthenticatedRequest, res: Response) {
		try {
			const data = await createFollowUp(req.body || {}, req.user.id);
			return ReS(res, SUCCESS_CODE, "Follow-up created", data);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async listFollowUps(req: AuthenticatedRequest, res: Response) {
		try {
			const data = await listFollowUps(
				{ ...(req.body || {}), ...(req.query || {}) },
				{ id: req.user.id, role: req.user.role },
			);
			return ReS(res, SUCCESS_CODE, "OK", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async completeFollowUp(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const data = await completeFollowUp(id, req.body || {}, req.user.id);
			return ReS(res, SUCCESS_CODE, "Follow-up completed", data);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async evaluate(req: AuthenticatedRequest, res: Response) {
		try {
			if (!canManageMasterTasks(req.user.role)) {
				return ReE(res, FORBIDDEN_CODE, "Admin only");
			}
			const esc = await evaluateTaskEscalations();
			const missed = await markMissedFollowUps();
			return ReS(res, SUCCESS_CODE, "Evaluated", { ...esc, ...missed });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}
}

export default new MasterTaskController();

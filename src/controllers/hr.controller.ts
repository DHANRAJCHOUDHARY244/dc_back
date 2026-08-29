import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
	BAD_REQUEST_CODE,
	FORBIDDEN_CODE,
	SERVER_ERROR_CODE,
	SUCCESS_CODE,
} from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import {
	AttendanceSource,
	AttendanceStatus,
	dayKey,
	endOfDay,
	formatHoursMinutes,
	startOfDay,
} from "@constants/attendance.constants";
import {
	attendanceAuditLogRepository,
	attendanceCorrectionRepository,
	attendanceMonthLockRepository,
	attendanceRecordRepository,
	attendanceSettingsRepository,
	employeeProfileRepository,
	holidayRepository,
	leaveBalanceRepository,
	leaveRequestRepository,
	leaveTypeRepository,
	shiftRepository,
	userRepository,
} from "@repositories";
import * as hr from "@services/hrAttendance.service";
import { displayEmployeeCode } from "@services/employeeId.service";
import notificationController from "@controllers/notification.controller";

function actor(req: AuthenticatedRequest) {
	return { id: req.user.id, role: req.user.role, name: req.user.name };
}

class HrController {
	/* ---------- bootstrap / settings ---------- */
	async bootstrap(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const result = await hr.migrateEmployeeProfiles();
			return ReS(res, SUCCESS_CODE, "HR bootstrap complete", result);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getSettings(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await hr.getSettings();
			return ReS(res, SUCCESS_CODE, "Settings", settings);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateSettings(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const settings = await hr.getSettings();
			const updated = await attendanceSettingsRepository.updateById(settings.id, {
				$set: { ...req.body, key: "default" },
			});
			await hr.writeAudit({
				actor_id: req.user.id,
				action: "UPDATE_SETTINGS",
				entity: "attendance_settings",
				entity_id: settings.id,
				old_value: settings,
				new_value: req.body,
			});
			return ReS(res, SUCCESS_CODE, "Settings updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- profiles ---------- */
	async listEmployees(req: AuthenticatedRequest, res: Response) {
		try {
			const { page = 1, limit = 20, search, department, team, employment_status } = req.body || {};
			const scope = await hr.teamUserIdsFor(actor(req));
			const filter: any = {};
			if (scope) filter.user_id = { $in: scope };
			if (department) filter.department = department;
			if (team) filter.team = team;
			if (employment_status) filter.employment_status = employment_status;

			const { rows, count } = await employeeProfileRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				lean: true,
				populate: [
					{ path: "user", select: "id name email username profile_image mobile_no role_id is_active" },
					{ path: "manager", select: "id name email" },
					{ path: "team_leader", select: "id name email" },
					{ path: "shift" },
				],
				sort: { id: -1 },
			});

			let data = rows;
			if (search) {
				const q = String(search).toLowerCase();
				data = rows.filter((r: any) => {
					const u = r.user || {};
					return (
						String(u.name || "").toLowerCase().includes(q) ||
						String(u.email || "").toLowerCase().includes(q) ||
						String(r.employee_code || "").toLowerCase().includes(q)
					);
				});
			}
			return ReS(res, SUCCESS_CODE, "Employees", {
				data,
				total: search ? data.length : count,
				page: Number(page),
				limit: Number(limit),
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getMyProfile(req: AuthenticatedRequest, res: Response) {
		try {
			const profile = await hr.ensureEmployeeProfile(req.user.id);
			const full = await employeeProfileRepository.findOne(
				{ user_id: req.user.id },
				{
					lean: true,
					populate: [
						{ path: "user", select: "id name email username profile_image mobile_no mobile_country_code" },
						{ path: "manager", select: "id name email" },
						{ path: "team_leader", select: "id name email" },
						{ path: "shift" },
					],
				},
			);
			return ReS(res, SUCCESS_CODE, "My profile", full || profile);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateEmployee(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const userId = Number(req.params.userId || req.body.user_id);
			if (!userId) return ReE(res, BAD_REQUEST_CODE, "user_id required");
			const existing = await hr.ensureEmployeeProfile(userId);
			const allowed = [
				"department",
				"designation",
				"team",
				"manager_id",
				"team_leader_id",
				"joining_date",
				"employment_status",
				"salary_type",
				"monthly_salary",
				"working_hours",
				"shift_id",
				"weekly_off_days",
				"attendance_enabled",
				"notes",
			];
			const patch: any = {};
			for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
			// employee_code is display-only (SE-{user_id}) — never manually edited
			patch.employee_code = displayEmployeeCode(userId);
			const updated = await employeeProfileRepository.updateById(existing.id, { $set: patch });
			await hr.writeAudit({
				actor_id: req.user.id,
				target_user_id: userId,
				action: "UPDATE_PROFILE",
				entity: "employee_profiles",
				entity_id: existing.id,
				old_value: existing,
				new_value: patch,
			});
			return ReS(res, SUCCESS_CODE, "Employee updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- punch ---------- */
	async checkIn(req: AuthenticatedRequest, res: Response) {
		try {
			const record = await hr.checkIn(actor(req), hr.clientIp(req));
			return ReS(res, SUCCESS_CODE, "Checked in", record);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async checkOut(req: AuthenticatedRequest, res: Response) {
		try {
			const record = await hr.checkOut(actor(req), hr.clientIp(req));
			return ReS(res, SUCCESS_CODE, "Checked out", record);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async todayMine(req: AuthenticatedRequest, res: Response) {
		try {
			await hr.ensureEmployeeProfile(req.user.id);
			const key = dayKey(new Date());
			const record = await attendanceRecordRepository.findOne(
				{ user_id: req.user.id, date_key: key },
				{ lean: true },
			);
			return ReS(res, SUCCESS_CODE, "Today", { date_key: key, record });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async hrMark(req: AuthenticatedRequest, res: Response) {
		try {
			const record = await hr.hrMarkAttendance(actor(req), req.body);
			return ReS(res, SUCCESS_CODE, "Attendance marked", record);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async listAttendance(req: AuthenticatedRequest, res: Response) {
		try {
			const {
				page = 1,
				limit = 50,
				user_id,
				status,
				start_date,
				end_date,
				department,
				team,
			} = req.body || {};
			const scope = await hr.teamUserIdsFor(actor(req));
			const filter: any = {};
			if (user_id) filter.user_id = Number(user_id);
			else if (scope) filter.user_id = { $in: scope };
			if (status) filter.status = status;
			if (start_date || end_date) {
				filter.date = {};
				if (start_date) filter.date.$gte = startOfDay(start_date);
				if (end_date) filter.date.$lte = endOfDay(end_date);
			}

			if (department || team) {
				const pf: any = {};
				if (department) pf.department = department;
				if (team) pf.team = team;
				const profiles: any[] = await employeeProfileRepository.find(pf, {
					lean: true,
					select: "user_id",
				});
				const ids = profiles.map((p) => p.user_id);
				filter.user_id = filter.user_id
					? { $in: ids.filter((id) => !scope || scope.includes(id)) }
					: { $in: ids };
			}

			const { rows, count } = await attendanceRecordRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				lean: true,
				sort: { date: -1 },
				populate: { path: "user", select: "id name email profile_image" },
			});
			return ReS(res, SUCCESS_CODE, "Attendance list", {
				data: rows,
				total: count,
				page: Number(page),
				limit: Number(limit),
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async dashboard(req: AuthenticatedRequest, res: Response) {
		try {
			const data = await hr.getDashboardToday(actor(req));
			return ReS(res, SUCCESS_CODE, "Dashboard", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async monthlyReport(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = Number(req.body.user_id || req.user.id);
			const year = Number(req.body.year || new Date().getFullYear());
			const month = Number(req.body.month || new Date().getMonth() + 1);
			const scope = await hr.teamUserIdsFor(actor(req));
			if (scope && !scope.includes(userId) && userId !== req.user.id) {
				return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			}
			const summary = await hr.computeAttendanceSummary(userId, year, month);
			const user = await userRepository.findOne(
				{ id: userId },
				{ lean: true, select: "id name email profile_image" },
			);
			const profile = await employeeProfileRepository.findOne({ user_id: userId }, { lean: true });
			return ReS(res, SUCCESS_CODE, "Monthly report", { user, profile, year, month, summary });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async exportCsv(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = Number(req.body.user_id || req.user.id);
			const year = Number(req.body.year || new Date().getFullYear());
			const month = Number(req.body.month || new Date().getMonth() + 1);
			const summary = await hr.computeAttendanceSummary(userId, year, month);
			const lines = ["Date,Day,Check In,Check Out,Hours,Status"];
			for (const r of summary.rows || []) {
				const d = new Date(r.date);
				const day = d.toLocaleDateString("en-AU", { weekday: "short" });
				const cin = r.check_in ? new Date(r.check_in).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "-";
				const cout = r.check_out ? new Date(r.check_out).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "-";
				const hours = r.net_minutes ? formatHoursMinutes(r.net_minutes) : "-";
				lines.push(`${r.date_key},${day},${cin},${cout},${hours},${r.status}`);
			}
			const csv = lines.join("\n");
			res.setHeader("Content-Type", "text/csv");
			res.setHeader("Content-Disposition", `attachment; filename=attendance-${userId}-${year}-${month}.csv`);
			return res.send(csv);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async attendanceSummary(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = Number(req.query.user_id || req.body?.user_id || req.user.id);
			const year = Number(req.query.year || req.body?.year || new Date().getFullYear());
			const month = Number(req.query.month || req.body?.month || new Date().getMonth() + 1);
			if (!hr.isHrAdmin(req.user.role) && userId !== req.user.id) {
				const scope = await hr.teamUserIdsFor(actor(req));
				if (scope && !scope.includes(userId)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			}
			const data = await hr.computeSalaryAttendance(userId, year, month);
			return ReS(res, SUCCESS_CODE, "Attendance summary", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- shifts ---------- */
	async listShifts(_req: AuthenticatedRequest, res: Response) {
		try {
			const rows = await shiftRepository.find({}, { lean: true, sort: { id: 1 } });
			return ReS(res, SUCCESS_CODE, "Shifts", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async saveShift(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const { id, ...rest } = req.body;
			let row: any;
			if (id) row = await shiftRepository.updateById(Number(id), { $set: rest });
			else row = await shiftRepository.create(rest);
			return ReS(res, SUCCESS_CODE, "Shift saved", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- holidays ---------- */
	async listHolidays(req: AuthenticatedRequest, res: Response) {
		try {
			const year = Number(req.body?.year || req.query.year || new Date().getFullYear());
			const start = new Date(year, 0, 1);
			const end = new Date(year, 11, 31, 23, 59, 59);
			const rows = await holidayRepository.find(
				{ date: { $gte: start, $lte: end } },
				{ lean: true, sort: { date: 1 } },
			);
			return ReS(res, SUCCESS_CODE, "Holidays", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async saveHoliday(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const date = new Date(req.body.date);
			if (Number.isNaN(date.getTime())) return ReE(res, BAD_REQUEST_CODE, "Invalid date");
			const payload = {
				name: req.body.name,
				date: startOfDay(date),
				date_key: dayKey(date),
				is_optional: !!req.body.is_optional,
				notes: req.body.notes || "",
			};
			let row: any;
			if (req.body.id) row = await holidayRepository.updateById(Number(req.body.id), { $set: payload });
			else row = await holidayRepository.create(payload);
			return ReS(res, SUCCESS_CODE, "Holiday saved", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async deleteHoliday(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			await holidayRepository.softDeleteById(Number(req.params.id));
			return ReS(res, SUCCESS_CODE, "Holiday deleted", true);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- leave ---------- */
	async listLeaveTypes(_req: AuthenticatedRequest, res: Response) {
		try {
			const rows = await hr.ensureLeaveTypes();
			return ReS(res, SUCCESS_CODE, "Leave types", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async myLeaveBalances(req: AuthenticatedRequest, res: Response) {
		try {
			const year = Number(req.query.year || new Date().getFullYear());
			const types: any[] = await hr.ensureLeaveTypes();
			const balances: any[] = await leaveBalanceRepository.find(
				{ user_id: req.user.id, year },
				{ lean: true },
			);
			const byType = new Map(balances.map((b) => [b.leave_type_id, b]));
			const data = types.map((t: any) => {
				const b = byType.get(t.id);
				return {
					leave_type: t,
					allocated: b?.allocated ?? t.default_days,
					used: b?.used ?? 0,
					pending: b?.pending ?? 0,
					remaining: (b?.allocated ?? t.default_days) - (b?.used ?? 0) - (b?.pending ?? 0),
				};
			});
			return ReS(res, SUCCESS_CODE, "Leave balances", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async submitLeave(req: AuthenticatedRequest, res: Response) {
		try {
			const { leave_type_id, start_date, end_date, reason, attachment } = req.body;
			if (!leave_type_id || !start_date || !end_date) {
				return ReE(res, BAD_REQUEST_CODE, "leave_type_id, start_date, end_date required");
			}
			const start = startOfDay(start_date);
			const end = startOfDay(end_date);
			const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
			const leaveType: any = await leaveTypeRepository.findOne({ id: Number(leave_type_id) }, { lean: true });
			if (!leaveType) return ReE(res, BAD_REQUEST_CODE, "Invalid leave type");

			const created = await leaveRequestRepository.create({
				user_id: req.user.id,
				leave_type_id: Number(leave_type_id),
				start_date: start,
				end_date: end,
				days,
				reason: reason || "",
				attachment: attachment || {},
				status: "PENDING_TL",
			});

			await notificationController
				.createNotification({
					userId: req.user.id,
					message: `Leave request submitted (${days} day(s))`,
					route: "/#/hr/leave",
					meta: { type: "LEAVE", id: created.id },
				})
				.catch(() => undefined);

			return ReS(res, SUCCESS_CODE, "Leave submitted", created);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async listLeaves(req: AuthenticatedRequest, res: Response) {
		try {
			const { status, page = 1, limit = 20, user_id } = req.body || {};
			const scope = await hr.teamUserIdsFor(actor(req));
			const filter: any = {};
			if (user_id) filter.user_id = Number(user_id);
			else if (scope) filter.user_id = { $in: scope };
			if (status) filter.status = status;
			const { rows, count } = await leaveRequestRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				lean: true,
				sort: { id: -1 },
				populate: [
					{ path: "user", select: "id name email" },
					{ path: "leave_type" },
				],
			});
			return ReS(res, SUCCESS_CODE, "Leave requests", { data: rows, total: count });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async actionLeave(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { action, note } = req.body; // approve | reject
			const leave: any = await leaveRequestRepository.findOne({ id }, { lean: true });
			if (!leave) return ReE(res, BAD_REQUEST_CODE, "Leave not found");

			const isHrApprover = hr.isHrLeaveApprover(req.user.role);
			const isTeamLead = hr.isHrTeamLead(req.user.role);
			let nextStatus = leave.status;
			const patch: any = {};

			if (action === "reject") {
				if (leave.status === "PENDING_TL") {
					if (!isTeamLead) return ReE(res, FORBIDDEN_CODE, "Only team lead can reject at this stage");
					nextStatus = "REJECTED";
					patch.tl_approver_id = req.user.id;
					patch.tl_action_at = new Date();
					patch.tl_note = note || "";
				} else if (leave.status === "PENDING_HR") {
					if (!isHrApprover) return ReE(res, FORBIDDEN_CODE, "Only HR can reject at this stage");
					nextStatus = "REJECTED";
					patch.hr_approver_id = req.user.id;
					patch.hr_action_at = new Date();
					patch.hr_note = note || "";
				} else {
					return ReE(res, FORBIDDEN_CODE, "Leave is not pending approval");
				}
			} else if (action === "approve") {
				if (leave.status === "PENDING_TL") {
					if (!isTeamLead) {
						return ReE(res, FORBIDDEN_CODE, "Only team lead can approve at this stage");
					}
					nextStatus = "PENDING_HR";
					patch.tl_approver_id = req.user.id;
					patch.tl_action_at = new Date();
					patch.tl_note = note || "";
				} else if (leave.status === "PENDING_HR") {
					if (!isHrApprover) {
						return ReE(res, FORBIDDEN_CODE, "Only HR can give final approval");
					}
					nextStatus = "APPROVED";
					patch.hr_approver_id = req.user.id;
					patch.hr_action_at = new Date();
					patch.hr_note = note || "";
				} else {
					return ReE(res, FORBIDDEN_CODE, "Not allowed to approve at this stage");
				}
			} else {
				return ReE(res, BAD_REQUEST_CODE, "action must be approve or reject");
			}

			patch.status = nextStatus;
			const updated = await leaveRequestRepository.updateById(id, { $set: patch });

			if (nextStatus === "APPROVED") {
				const leaveType: any = await leaveTypeRepository.findOne(
					{ id: leave.leave_type_id },
					{ lean: true },
				);
				const status = leaveType?.is_paid ? AttendanceStatus.PAID_LEAVE : AttendanceStatus.UNPAID_LEAVE;
				const cursor = new Date(leave.start_date);
				const end = startOfDay(leave.end_date);
				while (cursor <= end) {
					const key = dayKey(cursor);
					const existing: any = await attendanceRecordRepository.findOne(
						{ user_id: leave.user_id, date_key: key },
						{ lean: true },
					);
					const payload = {
						user_id: leave.user_id,
						date: startOfDay(cursor),
						date_key: key,
						status,
						source: AttendanceSource.LEAVE,
						leave_request_id: leave.id,
						notes: leave.reason || leaveType?.name || "Leave",
					};
					if (existing) await attendanceRecordRepository.updateById(existing.id, { $set: payload });
					else await attendanceRecordRepository.create(payload);
					cursor.setDate(cursor.getDate() + 1);
				}
			}

			await notificationController
				.createNotification({
					userId: leave.user_id,
					message: `Leave request ${nextStatus.replace(/_/g, " ").toLowerCase()}`,
					route: "/#/hr/leave",
					meta: { type: "LEAVE", id },
				})
				.catch(() => undefined);

			return ReS(res, SUCCESS_CODE, "Leave updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- corrections ---------- */
	async submitCorrection(req: AuthenticatedRequest, res: Response) {
		try {
			const date = new Date(req.body.date);
			if (Number.isNaN(date.getTime())) return ReE(res, BAD_REQUEST_CODE, "Invalid date");
			await hr.assertMonthEditable(date, req.user.role);
			const key = dayKey(date);
			const existing = await attendanceRecordRepository.findOne(
				{ user_id: req.user.id, date_key: key },
				{ lean: true },
			);
			const created = await attendanceCorrectionRepository.create({
				user_id: req.user.id,
				date: startOfDay(date),
				date_key: key,
				original_record: existing || {},
				requested_check_in: req.body.requested_check_in ? new Date(req.body.requested_check_in) : null,
				requested_check_out: req.body.requested_check_out ? new Date(req.body.requested_check_out) : null,
				requested_status: req.body.requested_status || "",
				reason: req.body.reason || "",
				attachment: req.body.attachment || {},
				status: "PENDING_TL",
			});
			return ReS(res, SUCCESS_CODE, "Correction submitted", created);
		} catch (e: any) {
			return ReE(res, BAD_REQUEST_CODE, e.message);
		}
	}

	async listCorrections(req: AuthenticatedRequest, res: Response) {
		try {
			const { status, page = 1, limit = 20 } = req.body || {};
			const scope = await hr.teamUserIdsFor(actor(req));
			const filter: any = {};
			if (scope) filter.user_id = { $in: scope };
			if (status) filter.status = status;
			const { rows, count } = await attendanceCorrectionRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				lean: true,
				sort: { id: -1 },
				populate: { path: "user", select: "id name email" },
			});
			return ReS(res, SUCCESS_CODE, "Corrections", { data: rows, total: count });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async actionCorrection(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { action, note } = req.body;
			const corr: any = await attendanceCorrectionRepository.findOne({ id }, { lean: true });
			if (!corr) return ReE(res, BAD_REQUEST_CODE, "Correction not found");
			const isHrApprover = hr.isHrLeaveApprover(req.user.role);
			const isTeamLead = hr.isHrTeamLead(req.user.role);
			let nextStatus = corr.status;
			const patch: any = {};

			if (action === "reject") {
				if (corr.status === "PENDING_TL") {
					if (!isTeamLead) return ReE(res, FORBIDDEN_CODE, "Only team lead can reject at this stage");
					nextStatus = "REJECTED";
					patch.tl_approver_id = req.user.id;
					patch.tl_action_at = new Date();
					patch.tl_note = note || "";
				} else if (corr.status === "PENDING_HR") {
					if (!isHrApprover) return ReE(res, FORBIDDEN_CODE, "Only HR can reject at this stage");
					nextStatus = "REJECTED";
					patch.hr_approver_id = req.user.id;
					patch.hr_action_at = new Date();
					patch.hr_note = note || "";
				} else {
					return ReE(res, FORBIDDEN_CODE, "Correction is not pending approval");
				}
			} else if (action === "approve") {
				if (corr.status === "PENDING_TL") {
					if (!isTeamLead) return ReE(res, FORBIDDEN_CODE, "Only team lead can approve at this stage");
					nextStatus = "PENDING_HR";
					patch.tl_approver_id = req.user.id;
					patch.tl_action_at = new Date();
					patch.tl_note = note || "";
				} else if (corr.status === "PENDING_HR") {
					if (!isHrApprover) return ReE(res, FORBIDDEN_CODE, "Only HR can give final approval");
					nextStatus = "APPROVED";
					patch.hr_approver_id = req.user.id;
					patch.hr_action_at = new Date();
					patch.hr_note = note || "";
				} else return ReE(res, FORBIDDEN_CODE, "Not allowed");
			} else return ReE(res, BAD_REQUEST_CODE, "Invalid action");

			patch.status = nextStatus;
			const updated = await attendanceCorrectionRepository.updateById(id, { $set: patch });

			if (nextStatus === "APPROVED") {
				if (!isHrApprover) return ReE(res, FORBIDDEN_CODE, "Only HR can finalize correction");
				await hr.hrMarkAttendance(actor(req), {
					user_id: corr.user_id,
					date: corr.date,
					check_in: corr.requested_check_in,
					check_out: corr.requested_check_out,
					status: corr.requested_status || undefined,
					notes: `Correction #${id}: ${corr.reason}`,
					reason: corr.reason,
				});
				const existing: any = await attendanceRecordRepository.findOne(
					{ user_id: corr.user_id, date_key: corr.date_key },
					{ lean: true },
				);
				if (existing) {
					await attendanceRecordRepository.updateById(existing.id, {
						$set: { source: AttendanceSource.CORRECTION, correction_id: id },
					});
				}
			}

			await notificationController
				.createNotification({
					userId: corr.user_id,
					message: `Attendance correction ${nextStatus.replace(/_/g, " ").toLowerCase()}`,
					route: "/#/hr/corrections",
					meta: { type: "ATTENDANCE_CORRECTION", id },
				})
				.catch(() => undefined);

			return ReS(res, SUCCESS_CODE, "Correction updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- month lock ---------- */
	async lockMonth(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const year = Number(req.body.year);
			const month = Number(req.body.month);
			if (!year || !month) return ReE(res, BAD_REQUEST_CODE, "year and month required");
			const existing: any = await attendanceMonthLockRepository.findOne({ year, month }, { lean: true });
			let row: any;
			if (existing) {
				row = await attendanceMonthLockRepository.updateById(existing.id, {
					$set: {
						locked: true,
						locked_by: req.user.id,
						locked_at: new Date(),
						note: req.body.note || "",
					},
				});
			} else {
				row = await attendanceMonthLockRepository.create({
					year,
					month,
					locked: true,
					locked_by: req.user.id,
					locked_at: new Date(),
					note: req.body.note || "",
				});
			}
			await attendanceRecordRepository.updateMany(
				{
					date: {
						$gte: new Date(year, month - 1, 1),
						$lte: new Date(year, month, 0, 23, 59, 59),
					},
				},
				{ $set: { is_locked: true } },
			);
			await hr.writeAudit({
				actor_id: req.user.id,
				action: "LOCK_MONTH",
				entity: "attendance_month_locks",
				entity_id: row.id,
				reason: req.body.note || "",
				meta: { year, month },
			});
			return ReS(res, SUCCESS_CODE, "Month locked", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async unlockMonth(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const year = Number(req.body.year);
			const month = Number(req.body.month);
			const existing: any = await attendanceMonthLockRepository.findOne({ year, month }, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Lock not found");
			const row = await attendanceMonthLockRepository.updateById(existing.id, {
				$set: {
					locked: false,
					unlocked_by: req.user.id,
					unlocked_at: new Date(),
					note: req.body.note || existing.note,
				},
			});
			await attendanceRecordRepository.updateMany(
				{
					date: {
						$gte: new Date(year, month - 1, 1),
						$lte: new Date(year, month, 0, 23, 59, 59),
					},
				},
				{ $set: { is_locked: false } },
			);
			await hr.writeAudit({
				actor_id: req.user.id,
				action: "UNLOCK_MONTH",
				entity: "attendance_month_locks",
				entity_id: existing.id,
				reason: req.body.note || "",
				meta: { year, month },
			});
			return ReS(res, SUCCESS_CODE, "Month unlocked", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async listLocks(_req: AuthenticatedRequest, res: Response) {
		try {
			const rows = await attendanceMonthLockRepository.find({}, { lean: true, sort: { year: -1, month: -1 } });
			return ReS(res, SUCCESS_CODE, "Locks", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- analytics ---------- */
	async analytics(req: AuthenticatedRequest, res: Response) {
		try {
			const year = Number(req.body?.year || new Date().getFullYear());
			const month = Number(req.body?.month || new Date().getMonth() + 1);
			const prevMonth = month === 1 ? 12 : month - 1;
			const prevYear = month === 1 ? year - 1 : year;
			const scope = await hr.teamUserIdsFor(actor(req));
			const profileFilter: any = { attendance_enabled: true };
			if (scope) profileFilter.user_id = { $in: scope };
			const profiles: any[] = await employeeProfileRepository.find(profileFilter, { lean: true });

			const byDept: Record<string, { present: number; absent: number; late: number; total: number }> = {};
			const byTeam: Record<string, { present: number; absent: number; late: number; total: number }> = {};
			let monthPresent = 0;
			let monthAbsent = 0;
			let monthLate = 0;
			let prevPresent = 0;

			for (const p of profiles) {
				const cur = await hr.computeAttendanceSummary(p.user_id, year, month);
				const prev = await hr.computeAttendanceSummary(p.user_id, prevYear, prevMonth);
				monthPresent += cur.present + cur.late + cur.half_day;
				monthAbsent += cur.absent;
				monthLate += cur.late;
				prevPresent += prev.present + prev.late + prev.half_day;

				const dept = p.department || "Unassigned";
				const team = p.team || "Unassigned";
				byDept[dept] = byDept[dept] || { present: 0, absent: 0, late: 0, total: 0 };
				byTeam[team] = byTeam[team] || { present: 0, absent: 0, late: 0, total: 0 };
				byDept[dept].present += cur.present;
				byDept[dept].absent += cur.absent;
				byDept[dept].late += cur.late;
				byDept[dept].total += 1;
				byTeam[team].present += cur.present;
				byTeam[team].absent += cur.absent;
				byTeam[team].late += cur.late;
				byTeam[team].total += 1;
			}

			return ReS(res, SUCCESS_CODE, "Analytics", {
				year,
				month,
				employees: profiles.length,
				month_present_days: monthPresent,
				month_absent_days: monthAbsent,
				month_late_days: monthLate,
				prev_present_days: prevPresent,
				mom_delta_present: monthPresent - prevPresent,
				by_department: byDept,
				by_team: byTeam,
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- onboarding ---------- */
	async listOnboarding(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrOnboardingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const { onboarding_status, page = 1, limit = 50, search } = req.body || {};
			const filter: any = {};
			if (onboarding_status) filter.onboarding_status = onboarding_status;
			const rows = await hr.listOnboardingProfiles(filter);
			let data = rows;
			if (search) {
				const q = String(search).toLowerCase();
				data = rows.filter((r: any) => {
					const u = r.user || {};
					return (
						String(u.name || "").toLowerCase().includes(q) ||
						String(u.email || "").toLowerCase().includes(q) ||
						String(r.employee_code || "").toLowerCase().includes(q)
					);
				});
			}
			const start = (Number(page) - 1) * Number(limit);
			const slice = data.slice(start, start + Number(limit));
			return ReS(res, SUCCESS_CODE, "Onboarding list", {
				data: slice,
				total: data.length,
				page: Number(page),
				limit: Number(limit),
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async startOnboarding(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrOnboardingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const userId = Number(req.body.user_id);
			if (!userId) return ReE(res, BAD_REQUEST_CODE, "user_id required");
			const updated = await hr.startEmployeeOnboarding(userId, req.user.id);
			return ReS(res, SUCCESS_CODE, "Onboarding started", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateOnboardingTask(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrOnboardingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const userId = Number(req.params.userId);
			const { task_key, done } = req.body;
			if (!task_key) return ReE(res, BAD_REQUEST_CODE, "task_key required");
			const updated = await hr.updateOnboardingTask(userId, String(task_key), Boolean(done));
			return ReS(res, SUCCESS_CODE, "Task updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async auditLogs(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const { page = 1, limit = 50, target_user_id, action } = req.body || {};
			const filter: any = {};
			if (target_user_id) filter.target_user_id = Number(target_user_id);
			if (action) filter.action = action;
			const { rows, count } = await attendanceAuditLogRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				lean: true,
				sort: { id: -1 },
			});
			return ReS(res, SUCCESS_CODE, "Audit logs", { data: rows, total: count });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async finalizeAbsents(req: AuthenticatedRequest, res: Response) {
		try {
			if (!hr.isHrAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const date = req.body.date ? new Date(req.body.date) : new Date();
			const result = await hr.finalizeMissingAbsents(date);
			return ReS(res, SUCCESS_CODE, "Finalized", result);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}
}

export default new HrController();

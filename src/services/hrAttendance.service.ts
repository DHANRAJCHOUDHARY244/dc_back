import {
	AttendanceSource,
	AttendanceStatus,
	DEFAULT_LEAVE_TYPES,
	EmploymentStatus,
	DEFAULT_ONBOARDING_TASKS,
	HR_ADMIN_ROLES,
	HR_LEAVE_APPROVER_ROLES,
	HR_MANAGER_ROLES,
	HR_ONBOARDING_ROLES,
	HR_TEAM_LEAD_ROLES,
	dayKey,
	endOfDay,
	formatHoursMinutes,
	minutesBetween,
	parseHhMm,
	startOfDay,
} from "@constants/attendance.constants";
import {
	attendanceAuditLogRepository,
	attendanceCorrectionRepository,
	attendanceMonthLockRepository,
	attendancePunchRepository,
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
import { Roles } from "src/data/dataInserter";
import { dispatchNotification } from "@services/notificationHandler.service";
import { displayEmployeeCode, resolveEmployeeCode } from "@services/employeeId.service";

type AnyUser = { id: number; role?: string; name?: string };

export type AttendanceLocation = {
	lat: number;
	lng: number;
	accuracy?: number;
	address?: string;
	captured_at?: string;
};

export function normalizeAttendanceLocation(input: unknown): AttendanceLocation | null {
	if (!input || typeof input !== "object") return null;
	const raw = input as Record<string, unknown>;
	const lat = Number(raw.lat ?? raw.latitude);
	const lng = Number(raw.lng ?? raw.longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	const accuracy = raw.accuracy != null ? Number(raw.accuracy) : undefined;
	return {
		lat,
		lng,
		accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
		address: raw.address ? String(raw.address) : undefined,
		captured_at: new Date().toISOString(),
	};
}

function hasCoords(location: unknown): location is AttendanceLocation {
	return (
		!!location &&
		typeof location === "object" &&
		Number.isFinite((location as AttendanceLocation).lat) &&
		Number.isFinite((location as AttendanceLocation).lng)
	);
}

async function getOpenPunch(userId: number, dateKey: string) {
	return attendancePunchRepository.findOne(
		{ user_id: userId, date_key: dateKey, check_out_at: null },
		{ lean: true, sort: { check_in_at: -1 } },
	);
}

async function listPunchesForDay(userId: number, dateKey: string) {
	return attendancePunchRepository.find(
		{ user_id: userId, date_key: dateKey },
		{ lean: true, sort: { check_in_at: 1 } },
	);
}

function sumPunchMinutes(punches: any[], includeOpen = true) {
	const now = new Date();
	return punches.reduce((sum, punch) => {
		if (punch.check_out_at) return sum + Number(punch.duration_minutes || 0);
		if (!includeOpen) return sum;
		return sum + minutesBetween(new Date(punch.check_in_at), now);
	}, 0);
}

async function syncDailyRecordFromPunches(userId: number, dateKey: string, shift: any, settings: any) {
	const punches: any[] = await listPunchesForDay(userId, dateKey);
	if (!punches.length) return null;

	const record: any = await attendanceRecordRepository.findOne(
		{ user_id: userId, date_key: dateKey },
		{ lean: true },
	);
	if (!record) return null;

	const openPunch = punches.find((p) => !p.check_out_at);
	const firstIn = new Date(punches[0].check_in_at);
	const lastClosed = [...punches].reverse().find((p) => p.check_out_at);
	const lastOut = openPunch ? null : lastClosed ? new Date(lastClosed.check_out_at) : null;
	const totalMinutes = sumPunchMinutes(punches, true);
	const breakMinutes = Number(record.break_minutes || settings?.default_break_minutes || 0);
	const netMinutes = Math.max(0, totalMinutes - (lastOut ? breakMinutes : 0));
	const metrics = computePunchMetrics(firstIn, lastOut, shift, settings);

	await attendanceRecordRepository.updateById(record.id, {
		$set: {
			check_in: firstIn,
			check_out: lastOut,
			total_minutes: totalMinutes,
			net_minutes: netMinutes,
			status: metrics.status,
			late_minutes: metrics.late_minutes,
			early_departure_minutes: lastOut ? metrics.early_departure_minutes : 0,
			overtime_minutes: lastOut ? metrics.overtime_minutes : 0,
		},
	});

	return attendanceRecordRepository.findOne({ id: record.id }, { lean: true });
}

export async function buildTodayAttendancePayload(userId: number, dateKey = dayKey(new Date())) {
	const [record, punches, openPunch] = await Promise.all([
		attendanceRecordRepository.findOne({ user_id: userId, date_key: dateKey }, { lean: true }),
		listPunchesForDay(userId, dateKey),
		getOpenPunch(userId, dateKey),
	]);
	const totalSpentMinutes = sumPunchMinutes(punches, true);
	return {
		date_key: dateKey,
		record,
		punches,
		active_punch: openPunch,
		is_checked_in: !!openPunch,
		total_spent_minutes: totalSpentMinutes,
		total_spent_label: formatHoursMinutes(totalSpentMinutes),
		live_location: openPunch?.live_location || null,
	};
}

/** Public API for today's attendance — used by HTTP layer and future clients. */
export async function getTodayAttendance(userId: number) {
	await ensureEmployeeProfile(userId);
	return buildTodayAttendancePayload(userId);
}

export async function getAttendanceMapPunches(user: AnyUser, days = 10, targetUserId?: number) {
	const scope = await teamUserIdsFor(user);
	const userId = targetUserId ?? user.id;
	if (scope && !scope.includes(userId) && userId !== user.id) {
		throw new Error("Unauthorized");
	}
	if (!scope && targetUserId && !isHrAdmin(user.role) && !isHrManager(user.role) && targetUserId !== user.id) {
		throw new Error("Unauthorized");
	}

	const since = new Date();
	since.setDate(since.getDate() - Math.max(1, Math.min(days, 30)));
	since.setHours(0, 0, 0, 0);

	const punches: any[] = await attendancePunchRepository.find(
		{
			user_id: userId,
			check_in_at: { $gte: since },
		},
		{ lean: true, sort: { check_in_at: -1 } },
	);

	const markers = buildPunchMarkers(punches);

	const totalSpentMinutes = sumPunchMinutes(punches, true);
	const openPunch = await getOpenPunch(userId, dayKey(new Date()));

	return {
		days,
		user_id: userId,
		since: since.toISOString(),
		is_checked_in: !!openPunch,
		punches,
		markers,
		total_spent_minutes: totalSpentMinutes,
		total_spent_label: formatHoursMinutes(totalSpentMinutes),
		live_location: openPunch?.live_location || null,
	};
}

export async function getTeamAttendanceMapToday(user: AnyUser) {
	if (!canViewTeamAttendanceMap(user.role)) {
		throw new Error("Unauthorized");
	}

	const scope = await teamUserIdsFor(user);
	const key = dayKey(new Date());
	const filter: Record<string, unknown> = { date_key: key };
	if (scope) filter.user_id = { $in: scope };

	const punches: any[] = await attendancePunchRepository.find(filter, {
		lean: true,
		sort: { check_in_at: -1 },
	});

	const userIds = punches.map((p) => p.user_id);
	const userMeta = await loadUserMeta(userIds);
	const enrichedPunches = punches.map((punch) => ({
		...punch,
		user_name: userMeta.get(punch.user_id)?.name || `User #${punch.user_id}`,
		employee_code: userMeta.get(punch.user_id)?.employee_code || "",
	}));
	const markers = buildPunchMarkers(punches, userMeta);
	const totalSpentMinutes = sumPunchMinutes(punches, true);
	const activeEmployees = new Set(
		punches.filter((p) => !p.check_out_at).map((p) => p.user_id),
	).size;

	return {
		mode: "team_today",
		date_key: key,
		scope: scope ? "team" : "all",
		employee_count: new Set(userIds).size,
		active_employee_count: activeEmployees,
		punches: enrichedPunches,
		markers,
		total_spent_minutes: totalSpentMinutes,
		total_spent_label: formatHoursMinutes(totalSpentMinutes),
		is_checked_in: activeEmployees > 0,
	};
}

export async function updateLiveAttendanceLocation(user: AnyUser, locationInput: unknown) {
	const location = normalizeAttendanceLocation(locationInput);
	if (!location) throw new Error("Valid location is required");

	const key = dayKey(new Date());
	const openPunch: any = await getOpenPunch(user.id, key);
	if (!openPunch) throw new Error("No active check-in session");

	const updated = await attendancePunchRepository.updateById(openPunch.id, {
		$set: { live_location: location },
	});
	return updated;
}

function buildPunchMarkers(
	punches: any[],
	userMeta?: Map<number, { name: string; employee_code?: string }>,
) {
	return punches.flatMap((punch) => {
		const meta = {
			user_id: punch.user_id,
			user_name: userMeta?.get(punch.user_id)?.name || `User #${punch.user_id}`,
			employee_code: userMeta?.get(punch.user_id)?.employee_code || "",
		};
		const items: any[] = [];
		if (hasCoords(punch.check_in_location)) {
			items.push({
				id: `${punch.id}-in`,
				punch_id: punch.id,
				type: "check_in",
				at: punch.check_in_at,
				location: punch.check_in_location,
				duration_minutes: punch.duration_minutes,
				open: !punch.check_out_at,
				...meta,
			});
		}
		if (hasCoords(punch.check_out_location)) {
			items.push({
				id: `${punch.id}-out`,
				punch_id: punch.id,
				type: "check_out",
				at: punch.check_out_at,
				location: punch.check_out_location,
				duration_minutes: punch.duration_minutes,
				open: false,
				...meta,
			});
		}
		if (!punch.check_out_at && hasCoords(punch.live_location)) {
			items.push({
				id: `${punch.id}-live`,
				punch_id: punch.id,
				type: "live",
				at: punch.live_location?.captured_at || punch.check_in_at,
				location: punch.live_location,
				duration_minutes: punch.duration_minutes,
				open: true,
				...meta,
			});
		}
		return items;
	});
}

async function loadUserMeta(userIds: number[]) {
	const unique = [...new Set(userIds.filter((id) => id > 0))];
	if (!unique.length) return new Map<number, { name: string; employee_code?: string }>();

	const [users, profiles] = await Promise.all([
		userRepository.find({ id: { $in: unique } }, { select: "id name", lean: true }),
		employeeProfileRepository.find({ user_id: { $in: unique } }, { select: "user_id employee_code", lean: true }),
	]);

	const map = new Map<number, { name: string; employee_code?: string }>();
	for (const user of users as any[]) {
		map.set(user.id, { name: user.name || `User #${user.id}`, employee_code: "" });
	}
	for (const profile of profiles as any[]) {
		const existing = map.get(profile.user_id) || { name: `User #${profile.user_id}` };
		map.set(profile.user_id, {
			...existing,
			employee_code: profile.employee_code || existing.employee_code,
		});
	}
	return map;
}

export function canViewTeamAttendanceMap(role?: string) {
	return isHrAdmin(role) || isHrManager(role);
}

export function isHrAdmin(role?: string) {
	return HR_ADMIN_ROLES.includes(String(role || ""));
}

export function isHrManager(role?: string) {
	return HR_MANAGER_ROLES.includes(String(role || ""));
}

export function isHrLeaveApprover(role?: string) {
	return HR_LEAVE_APPROVER_ROLES.includes(String(role || ""));
}

export function isHrTeamLead(role?: string) {
	return HR_TEAM_LEAD_ROLES.includes(String(role || ""));
}

export function isHrOnboardingAdmin(role?: string) {
	return HR_ONBOARDING_ROLES.includes(String(role || ""));
}

export async function writeAudit(payload: {
	actor_id: number;
	target_user_id?: number | null;
	action: string;
	entity: string;
	entity_id?: number | null;
	date_key?: string;
	old_value?: unknown;
	new_value?: unknown;
	reason?: string;
	meta?: Record<string, unknown>;
}) {
	return attendanceAuditLogRepository.create({
		actor_id: payload.actor_id,
		target_user_id: payload.target_user_id ?? null,
		action: payload.action,
		entity: payload.entity,
		entity_id: payload.entity_id ?? null,
		date_key: payload.date_key || "",
		old_value: payload.old_value || {},
		new_value: payload.new_value || {},
		reason: payload.reason || "",
		meta: payload.meta || {},
	});
}

export async function getSettings() {
	let settings: any = await attendanceSettingsRepository.findOne({ key: "default" }, { lean: true });
	if (!settings) {
		settings = await attendanceSettingsRepository.create({ key: "default" });
		settings = settings.toObject ? settings.toObject() : settings;
	}
	return settings;
}

export async function ensureDefaultShift() {
	let shift: any = await shiftRepository.findOne({ is_default: true }, { lean: true });
	if (!shift) {
		shift = await shiftRepository.create({
			name: "General Shift",
			start_time: "09:00",
			end_time: "18:00",
			grace_minutes: 15,
			late_threshold_minutes: 15,
			half_day_hours: 4,
			min_full_day_hours: 7.5,
			break_minutes: 60,
			is_default: true,
			is_active: true,
		});
		shift = shift.toObject ? shift.toObject() : shift;
	}
	return shift;
}

export async function ensureLeaveTypes() {
	const existing = await leaveTypeRepository.find({}, { lean: true });
	const codes = new Set((existing || []).map((t: any) => t.code));
	for (const t of DEFAULT_LEAVE_TYPES) {
		if (!codes.has(t.code)) {
			await leaveTypeRepository.create(t);
		}
	}
	return leaveTypeRepository.find({ is_active: true }, { lean: true });
}

export async function ensureEmployeeProfile(userId: number) {
	let profile: any = await employeeProfileRepository.findOne({ user_id: userId }, { lean: true });
	const displayCode = displayEmployeeCode(userId);
	if (profile) {
		const expected = resolveEmployeeCode(userId, profile.employee_code);
		if (profile.employee_code !== expected) {
			profile = await employeeProfileRepository.updateById(profile.id, {
				$set: { employee_code: expected },
			});
			profile = profile?.toObject?.() || profile;
		}
		return profile;
	}
	const shift = await ensureDefaultShift();
	const user: any = await userRepository.findOne({ id: userId }, { lean: true });
	profile = await employeeProfileRepository.create({
		user_id: userId,
		employee_code: displayCode,
		department: "",
		designation: user?.role || "",
		joining_date: user?.created_at || new Date(),
		shift_id: shift.id,
		weekly_off_days: [0],
		attendance_enabled: true,
		employment_status: EmploymentStatus.ACTIVE,
		monthly_salary: 0,
	});
	return profile.toObject ? profile.toObject() : profile;
}

function assertEmploymentActive(profile: any) {
	const blocked = [EmploymentStatus.INACTIVE, EmploymentStatus.TERMINATED];
	if (blocked.includes(profile?.employment_status)) {
		throw new Error(
			`Employee ${profile?.employee_code || ""} is ${profile.employment_status}. Attendance is disabled for former/inactive staff.`,
		);
	}
}

export async function migrateEmployeeProfiles() {
	await ensureDefaultShift();
	await ensureLeaveTypes();
	await getSettings();

	const customerRole: any = await (await import("@repositories")).roleRepository.findOne(
		{ name: Roles.CUSTOMER },
		{ lean: true },
	);
	const filter: any = { is_active: true };
	if (customerRole?.id) filter.role_id = { $ne: customerRole.id };

	const users: any[] = await userRepository.find(filter, { lean: true, select: "id role_id name" });
	let created = 0;
	for (const u of users) {
		const exists = await employeeProfileRepository.findOne({ user_id: u.id }, { lean: true });
		if (!exists) {
			await ensureEmployeeProfile(u.id);
			created += 1;
		}
	}
	const { syncAllEmployeeDisplayCodes } = await import("@services/employeeId.service");
	const codes = await syncAllEmployeeDisplayCodes();
	return { users: users.length, created, codes_updated: codes.updated };
}

export async function isMonthLocked(year: number, month: number) {
	const lock: any = await attendanceMonthLockRepository.findOne(
		{ year, month, locked: true },
		{ lean: true },
	);
	return !!lock;
}

export async function assertMonthEditable(date: Date | string, role?: string) {
	const d = new Date(date);
	const locked = await isMonthLocked(d.getFullYear(), d.getMonth() + 1);
	if (locked && !isHrAdmin(role)) {
		throw new Error("This attendance month is locked. Contact HR/Admin.");
	}
	return locked;
}

async function getShiftForUser(profile: any, settings: any) {
	if (profile?.shift_id) {
		const shift: any = await shiftRepository.findOne({ id: profile.shift_id }, { lean: true });
		if (shift) return shift;
	}
	const def = await ensureDefaultShift();
	return {
		...def,
		grace_minutes: settings.grace_minutes ?? def.grace_minutes,
		late_threshold_minutes: settings.late_threshold_minutes ?? def.late_threshold_minutes,
		half_day_hours: settings.half_day_hours ?? def.half_day_hours,
		min_full_day_hours: settings.min_full_day_hours ?? def.min_full_day_hours,
		break_minutes: settings.break_minutes ?? def.break_minutes,
		start_time: settings.office_start || def.start_time,
		end_time: settings.office_end || def.end_time,
	};
}

export async function isWeeklyOff(date: Date, profile: any, settings: any, forceWorking = false) {
	if (forceWorking) return false;
	const offs: number[] = Array.isArray(profile?.weekly_off_days)
		? profile.weekly_off_days
		: settings.weekly_off_days || [0];
	return offs.includes(date.getDay());
}

export async function isPublicHoliday(date: Date) {
	const key = dayKey(date);
	const h: any = await holidayRepository.findOne({ date_key: key }, { lean: true });
	return h || null;
}

function computePunchMetrics(checkIn: Date, checkOut: Date | null, shift: any, settings: any) {
	const breakMinutes = Number(shift.break_minutes ?? settings.break_minutes ?? 60);
	const totalMinutes = checkOut ? minutesBetween(checkIn, checkOut) : 0;
	const netMinutes = checkOut ? Math.max(0, totalMinutes - breakMinutes) : 0;

	const start = parseHhMm(shift.start_time || settings.office_start || "09:00");
	const end = parseHhMm(shift.end_time || settings.office_end || "18:00");
	const shiftStart = new Date(checkIn);
	shiftStart.setHours(start.h, start.m, 0, 0);
	const shiftEnd = new Date(checkIn);
	shiftEnd.setHours(end.h, end.m, 0, 0);

	const grace = Number(shift.grace_minutes ?? settings.grace_minutes ?? 15);
	const lateThreshold = Number(shift.late_threshold_minutes ?? settings.late_threshold_minutes ?? 15);
	const lateRaw = Math.max(0, minutesBetween(shiftStart, checkIn) - grace);
	const lateMinutes = lateRaw >= lateThreshold ? lateRaw : lateRaw > 0 ? lateRaw : 0;

	const earlyDepartureMinutes =
		checkOut && checkOut < shiftEnd ? minutesBetween(checkOut, shiftEnd) : 0;

	const expectedNet = Number(shift.min_full_day_hours ?? settings.min_full_day_hours ?? 7.5) * 60;
	const overtimeMinutes = checkOut ? Math.max(0, netMinutes - expectedNet) : 0;

	const halfDayHours = Number(shift.half_day_hours ?? settings.half_day_hours ?? 4);
	const minFull = Number(shift.min_full_day_hours ?? settings.min_full_day_hours ?? 7.5);

	let status: AttendanceStatus = AttendanceStatus.PRESENT;
	if (checkOut) {
		const netHours = netMinutes / 60;
		if (netHours < halfDayHours) status = AttendanceStatus.ABSENT;
		else if (netHours < minFull) status = AttendanceStatus.HALF_DAY;
		else if (lateMinutes >= lateThreshold) status = AttendanceStatus.LATE;
		else status = AttendanceStatus.PRESENT;
	} else if (lateMinutes >= lateThreshold) {
		status = AttendanceStatus.LATE;
	}

	return {
		total_minutes: totalMinutes,
		break_minutes: breakMinutes,
		net_minutes: netMinutes,
		late_minutes: lateMinutes,
		early_departure_minutes: earlyDepartureMinutes,
		overtime_minutes: overtimeMinutes,
		status,
	};
}

export async function checkIn(user: AnyUser, ip = "", locationInput?: unknown) {
	const now = new Date();
	await assertMonthEditable(now, user.role);
	const profile = await ensureEmployeeProfile(user.id);
	if (!profile.attendance_enabled) throw new Error("Attendance is disabled for this employee");
	assertEmploymentActive(profile);

	const settings = await getSettings();
	const shift = await getShiftForUser(profile, settings);
	const key = dayKey(now);
	const location = normalizeAttendanceLocation(locationInput);

	const holiday = await isPublicHoliday(now);
	if (holiday) throw new Error("Today is a public holiday");

	const weeklyOff = await isWeeklyOff(now, profile, settings, false);
	if (weeklyOff) throw new Error("Today is weekly off");

	const openPunch = await getOpenPunch(user.id, key);
	if (openPunch) throw new Error("Already checked in");

	let record: any = await attendanceRecordRepository.findOne(
		{ user_id: user.id, date_key: key },
		{ lean: true },
	);

	const metrics = computePunchMetrics(now, null, shift, settings);
	const recordPayload = {
		user_id: user.id,
		employee_code: profile.employee_code || displayEmployeeCode(user.id),
		date: startOfDay(now),
		date_key: key,
		status: metrics.status,
		check_in: record?.check_in ? new Date(record.check_in) : now,
		check_out: null,
		check_in_ip: ip,
		check_in_location: record?.check_in_location?.lat ? record.check_in_location : location || {},
		source: AttendanceSource.SELF_PUNCH,
		late_minutes: metrics.late_minutes,
		break_minutes: metrics.break_minutes,
		total_minutes: record?.total_minutes || 0,
		net_minutes: record?.net_minutes || 0,
		early_departure_minutes: 0,
		overtime_minutes: 0,
		is_locked: false,
	};

	if (record) {
		record = await attendanceRecordRepository.updateById(record.id, { $set: recordPayload });
	} else {
		record = await attendanceRecordRepository.create(recordPayload);
	}

	const punch = await attendancePunchRepository.create({
		user_id: user.id,
		attendance_record_id: record.id,
		date_key: key,
		check_in_at: now,
		check_out_at: null,
		duration_minutes: 0,
		check_in_location: location || {},
		live_location: location || {},
		check_in_ip: ip,
		source: AttendanceSource.SELF_PUNCH,
	});

	await writeAudit({
		actor_id: user.id,
		target_user_id: user.id,
		action: "CHECK_IN",
		entity: "attendance_punches",
		entity_id: punch.id,
		date_key: key,
		new_value: { punch, location },
	});

	if (metrics.late_minutes > 0) {
		const punchesToday = await listPunchesForDay(user.id, key);
		if (punchesToday.length === 1) {
		await dispatchNotification({
				userId: user.id,
				message: `Late check-in recorded (${metrics.late_minutes} min).`,
				route: "/#/hr/attendance",
				meta: { type: "ATTENDANCE", action: "LATE" },
			})
			.catch(() => undefined);
		}
	}

	return buildTodayAttendancePayload(user.id, key);
}

export async function checkOut(user: AnyUser, ip = "", locationInput?: unknown) {
	const now = new Date();
	await assertMonthEditable(now, user.role);
	const profile = await ensureEmployeeProfile(user.id);
	assertEmploymentActive(profile);
	const settings = await getSettings();
	const shift = await getShiftForUser(profile, settings);
	const key = dayKey(now);
	const location = normalizeAttendanceLocation(locationInput);

	const openPunch: any = await getOpenPunch(user.id, key);
	if (!openPunch) throw new Error("Please check in first");

	const durationMinutes = minutesBetween(new Date(openPunch.check_in_at), now);
	const closedPunch = await attendancePunchRepository.updateById(openPunch.id, {
		$set: {
			check_out_at: now,
			duration_minutes: durationMinutes,
			check_out_location: location || {},
			live_location: {},
			check_out_ip: ip,
		},
	});

	const record: any = await attendanceRecordRepository.findOne(
		{ user_id: user.id, date_key: key },
		{ lean: true },
	);
	if (!record) throw new Error("Attendance record not found");

	const updatedRecord = await syncDailyRecordFromPunches(user.id, key, shift, settings);

	await writeAudit({
		actor_id: user.id,
		target_user_id: user.id,
		action: "CHECK_OUT",
		entity: "attendance_punches",
		entity_id: openPunch.id,
		date_key: key,
		old_value: openPunch,
		new_value: { punch: closedPunch, location, duration_minutes: durationMinutes },
	});

	return {
		...(await buildTodayAttendancePayload(user.id, key)),
		record: updatedRecord || record,
	};
}

export async function hrMarkAttendance(actor: AnyUser, body: any) {
	if (!isHrAdmin(actor.role) && !isHrManager(actor.role)) {
		throw new Error("Unauthorized");
	}
	const userId = Number(body.user_id);
	const date = new Date(body.date);
	if (!userId || Number.isNaN(date.getTime())) throw new Error("user_id and date are required");

	const locked = await assertMonthEditable(date, actor.role);
	const key = dayKey(date);
	const profile = await ensureEmployeeProfile(userId);
	const settings = await getSettings();
	const shift = await getShiftForUser(profile, settings);

	const existing: any = await attendanceRecordRepository.findOne(
		{ user_id: userId, date_key: key },
		{ lean: true },
	);

	const checkInAt = body.check_in ? new Date(body.check_in) : existing?.check_in ? new Date(existing.check_in) : null;
	const checkOutAt = body.check_out
		? new Date(body.check_out)
		: existing?.check_out
			? new Date(existing.check_out)
			: null;

	let metrics: any = {
		total_minutes: 0,
		break_minutes: Number(shift.break_minutes || 60),
		net_minutes: 0,
		late_minutes: 0,
		early_departure_minutes: 0,
		overtime_minutes: 0,
	};
	let status = (body.status as AttendanceStatus) || AttendanceStatus.PRESENT;
	if (checkInAt && checkOutAt) {
		metrics = computePunchMetrics(checkInAt, checkOutAt, shift, settings);
		if (!body.status) status = metrics.status;
	}

	const payload = {
		user_id: userId,
		employee_code: profile.employee_code || displayEmployeeCode(userId),
		date: startOfDay(date),
		date_key: key,
		status,
		check_in: checkInAt,
		check_out: checkOutAt,
		...metrics,
		source: AttendanceSource.HR_MARK,
		notes: String(body.notes || ""),
		force_working: !!body.force_working,
		marked_by: actor.id,
		is_locked: locked && isHrAdmin(actor.role) ? false : !!existing?.is_locked,
	};

	let saved: any;
	if (existing) {
		saved = await attendanceRecordRepository.updateById(existing.id, { $set: payload });
	} else {
		saved = await attendanceRecordRepository.create(payload);
	}

	await writeAudit({
		actor_id: actor.id,
		target_user_id: userId,
		action: "HR_MARK",
		entity: "attendance_records",
		entity_id: saved.id,
		date_key: key,
		old_value: existing || {},
		new_value: payload,
		reason: body.reason || body.notes || "HR marked attendance",
	});

	return saved;
}

export async function ensureDaySystemStatus(userId: number, date: Date) {
	const key = dayKey(date);
	const existing: any = await attendanceRecordRepository.findOne(
		{ user_id: userId, date_key: key },
		{ lean: true },
	);
	if (existing) return existing;

	const profile = await ensureEmployeeProfile(userId);
	const settings = await getSettings();
	const holiday = await isPublicHoliday(date);
	if (holiday) {
		return attendanceRecordRepository.create({
			user_id: userId,
			date: startOfDay(date),
			date_key: key,
			status: AttendanceStatus.PUBLIC_HOLIDAY,
			source: AttendanceSource.SYSTEM,
			notes: holiday.name,
		});
	}
	const weeklyOff = await isWeeklyOff(date, profile, settings, false);
	if (weeklyOff) {
		return attendanceRecordRepository.create({
			user_id: userId,
			date: startOfDay(date),
			date_key: key,
			status: AttendanceStatus.WEEKLY_OFF,
			source: AttendanceSource.SYSTEM,
		});
	}
	return null;
}

export async function finalizeMissingAbsents(forDate = new Date()) {
	const date = startOfDay(forDate);
	const key = dayKey(date);
	const profiles: any[] = await employeeProfileRepository.find(
		{ attendance_enabled: true, employment_status: { $in: ["ACTIVE", "PROBATION"] } },
		{ lean: true },
	);
	let created = 0;
	for (const p of profiles) {
		const existing: any = await attendanceRecordRepository.findOne(
			{ user_id: p.user_id, date_key: key },
			{ lean: true },
		);
		if (existing) {
			if (existing.check_in && !existing.check_out) {
				await dispatchNotification({
						userId: p.user_id,
						message: `Missing check-out for ${key}`,
						route: "/#/hr/attendance",
						meta: { type: "ATTENDANCE", action: "MISSING_CHECKOUT" },
					})
					.catch(() => undefined);
			}
			continue;
		}
		const sys = await ensureDaySystemStatus(p.user_id, date);
		if (sys) continue;
		await attendanceRecordRepository.create({
			user_id: p.user_id,
			date,
			date_key: key,
			status: AttendanceStatus.ABSENT,
			source: AttendanceSource.SYSTEM,
		});
		created += 1;
	}
	return { date_key: key, created };
}

export function emptySummary() {
	return {
		calendar_days: 0,
		working_days: 0,
		present: 0,
		late: 0,
		half_day: 0,
		absent: 0,
		paid_leave: 0,
		unpaid_leave: 0,
		weekly_off: 0,
		public_holiday: 0,
		wfh: 0,
		on_duty: 0,
		total_minutes: 0,
		overtime_minutes: 0,
		deduction_days: 0,
		attendance_percentage: 0,
		total_working_hours_label: "0h 00m",
		total_overtime_label: "0h 00m",
	};
}

export async function computeAttendanceSummary(userId: number, year: number, month: number) {
	const start = new Date(year, month - 1, 1);
	const end = new Date(year, month, 0, 23, 59, 59, 999);
	const settings = await getSettings();
	const deductible: string[] = settings.deductible_statuses || ["ABSENT", "UNPAID_LEAVE"];
	const halfFraction = Number(settings.half_day_deduction_fraction ?? 0.5);

	const rows: any[] = await attendanceRecordRepository.find(
		{ user_id: userId, date: { $gte: start, $lte: end } },
		{ lean: true, sort: { date: 1 } },
	);

	const summary: any = emptySummary();
	summary.calendar_days = end.getDate();

	for (const r of rows) {
		const st = r.status;
		if (st === AttendanceStatus.PRESENT) summary.present += 1;
		else if (st === AttendanceStatus.LATE) summary.late += 1;
		else if (st === AttendanceStatus.HALF_DAY) summary.half_day += 1;
		else if (st === AttendanceStatus.ABSENT) summary.absent += 1;
		else if (st === AttendanceStatus.PAID_LEAVE) summary.paid_leave += 1;
		else if (st === AttendanceStatus.UNPAID_LEAVE) summary.unpaid_leave += 1;
		else if (st === AttendanceStatus.WEEKLY_OFF) summary.weekly_off += 1;
		else if (st === AttendanceStatus.PUBLIC_HOLIDAY) summary.public_holiday += 1;
		else if (st === AttendanceStatus.WFH) summary.wfh += 1;
		else if (st === AttendanceStatus.ON_DUTY) summary.on_duty += 1;

		summary.total_minutes += Number(r.net_minutes || 0);
		summary.overtime_minutes += Number(r.overtime_minutes || 0);

		if (deductible.includes(st)) summary.deduction_days += 1;
		else if (st === AttendanceStatus.HALF_DAY && deductible.includes(AttendanceStatus.HALF_DAY)) {
			summary.deduction_days += halfFraction;
		}
	}

	summary.working_days =
		summary.calendar_days - summary.weekly_off - summary.public_holiday;
	const attended =
		summary.present +
		summary.late +
		summary.half_day +
		summary.wfh +
		summary.on_duty +
		(settings.attendance_percentage_include_paid_leave ? summary.paid_leave : 0);
	summary.attendance_percentage =
		summary.working_days > 0 ? Math.round((attended / summary.working_days) * 1000) / 10 : 0;
	summary.total_working_hours_label = formatHoursMinutes(summary.total_minutes);
	summary.total_overtime_label = formatHoursMinutes(summary.overtime_minutes);
	summary.rows = rows;
	return summary;
}

export async function computeSalaryAttendance(userId: number, year: number, month: number) {
	const profile = await ensureEmployeeProfile(userId);
	const summary = await computeAttendanceSummary(userId, year, month);
	const monthly = Number(profile.monthly_salary || 0);
	const workingDays = Math.max(1, summary.working_days || 1);
	const perDay = monthly / workingDays;
	const deduction = Math.round(perDay * summary.deduction_days * 100) / 100;
	const payable = Math.max(0, Math.round((monthly - deduction) * 100) / 100);
	return {
		employee: {
			user_id: userId,
			monthly_salary: monthly,
			employee_code: profile.employee_code,
		},
		...summary,
		salary_deduction: deduction,
		final_payable_salary: payable,
		per_day_salary: Math.round(perDay * 100) / 100,
	};
}

export async function getDashboardToday(actor: AnyUser) {
	const today = startOfDay(new Date());
	const key = dayKey(today);
	const profileFilter: any = { attendance_enabled: true, employment_status: { $in: ["ACTIVE", "PROBATION"] } };
	if (!isHrAdmin(actor.role) && !isHrManager(actor.role)) {
		profileFilter.user_id = actor.id;
	} else if (!isHrAdmin(actor.role)) {
		profileFilter.$or = [{ team_leader_id: actor.id }, { manager_id: actor.id }];
	}

	const profiles: any[] = await employeeProfileRepository.find(profileFilter, { lean: true });
	const userIds = profiles.map((p) => p.user_id);
	const records: any[] = await attendanceRecordRepository.find(
		{ user_id: { $in: userIds }, date_key: key },
		{ lean: true },
	);
	const byUser = new Map(records.map((r) => [r.user_id, r]));

	const counts: Record<string, number> = {
		total_employees: userIds.length,
		present: 0,
		absent: 0,
		late: 0,
		half_day: 0,
		on_leave: 0,
		weekly_off: 0,
		wfh: 0,
		on_duty: 0,
		public_holiday: 0,
		missing_checkout: 0,
	};

	for (const id of userIds) {
		const r = byUser.get(id);
		if (!r) {
			counts.absent += 1;
			continue;
		}
		if (r.check_in && !r.check_out) counts.missing_checkout += 1;
		if (r.status === AttendanceStatus.PRESENT) counts.present += 1;
		else if (r.status === AttendanceStatus.LATE) counts.late += 1;
		else if (r.status === AttendanceStatus.HALF_DAY) counts.half_day += 1;
		else if (r.status === AttendanceStatus.ABSENT) counts.absent += 1;
		else if (r.status === AttendanceStatus.PAID_LEAVE || r.status === AttendanceStatus.UNPAID_LEAVE)
			counts.on_leave += 1;
		else if (r.status === AttendanceStatus.WEEKLY_OFF) counts.weekly_off += 1;
		else if (r.status === AttendanceStatus.WFH) counts.wfh += 1;
		else if (r.status === AttendanceStatus.ON_DUTY) counts.on_duty += 1;
		else if (r.status === AttendanceStatus.PUBLIC_HOLIDAY) counts.public_holiday += 1;
	}

	const pendingCorrections = await attendanceCorrectionRepository.count({
		status: { $in: ["PENDING_TL", "PENDING_HR"] },
	});
	const attended = counts.present + counts.late + counts.half_day + counts.wfh + counts.on_duty;
	const denom = Math.max(1, counts.total_employees - counts.weekly_off - counts.public_holiday);
	return {
		date_key: key,
		...counts,
		attendance_percentage: Math.round((attended / denom) * 1000) / 10,
		pending_corrections: pendingCorrections,
	};
}

export async function teamUserIdsFor(actor: AnyUser): Promise<number[] | null> {
	if (isHrAdmin(actor.role) || isHrLeaveApprover(actor.role)) return null;
	if (isHrManager(actor.role)) {
		const profiles: any[] = await employeeProfileRepository.find(
			{ $or: [{ team_leader_id: actor.id }, { manager_id: actor.id }] },
			{ lean: true, select: "user_id" },
		);
		const ids = profiles.map((p) => p.user_id);
		if (!ids.includes(actor.id)) ids.push(actor.id);
		return ids;
	}
	return [actor.id];
}

export function clientIp(req: any): string {
	return (
		(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
		req.socket?.remoteAddress ||
		req.ip ||
		""
	);
}

function defaultOnboardingTasks() {
	return DEFAULT_ONBOARDING_TASKS.map((t) => ({
		key: t.key,
		label: t.label,
		done: false,
		done_at: null as Date | null,
	}));
}

export async function listOnboardingProfiles(filter: Record<string, unknown> = {}) {
	const rows: any[] = await employeeProfileRepository.find(filter, {
		lean: true,
		sort: { id: -1 },
		populate: [
			{ path: "user", select: "id name email role_id is_active" },
			{ path: "manager", select: "id name" },
			{ path: "team_leader", select: "id name" },
		],
	});
	return rows;
}

export async function startEmployeeOnboarding(userId: number, actorId: number) {
	await ensureEmployeeProfile(userId);
	const profile: any = await employeeProfileRepository.findOne({ user_id: userId }, { lean: true });
	const tasks =
		profile?.onboarding_tasks?.length > 0 ? profile.onboarding_tasks : defaultOnboardingTasks();
	const updated = await employeeProfileRepository.updateById(profile.id, {
		$set: {
			employment_status: EmploymentStatus.PROBATION,
			onboarding_status: "IN_PROGRESS",
			onboarding_tasks: tasks,
			onboarding_completed_at: null,
			notes: profile?.notes || `Onboarding started by user #${actorId}`,
		},
	});
	await dispatchNotification({
			userId,
			message: "Welcome! Your HR onboarding has started — complete the checklist in HR.",
			route: "/#/hr/onboarding",
			meta: { type: "ONBOARDING", user_id: userId },
		})
		.catch(() => undefined);
	return updated;
}

export async function updateOnboardingTask(
	userId: number,
	taskKey: string,
	done: boolean,
) {
	const profile: any = await ensureEmployeeProfile(userId);
	let tasks = profile.onboarding_tasks?.length ? [...profile.onboarding_tasks] : defaultOnboardingTasks();
	const idx = tasks.findIndex((t: any) => t.key === taskKey);
	if (idx >= 0) {
		tasks[idx] = { ...tasks[idx], done, done_at: done ? new Date() : null };
	} else {
		tasks.push({
			key: taskKey,
			label: taskKey,
			done,
			done_at: done ? new Date() : null,
		});
	}
	const allDone = tasks.length > 0 && tasks.every((t: any) => t.done);
	const patch: Record<string, unknown> = {
		onboarding_tasks: tasks,
		onboarding_status: allDone ? "COMPLETED" : "IN_PROGRESS",
	};
	if (allDone) {
		patch.onboarding_completed_at = new Date();
		patch.employment_status = EmploymentStatus.ACTIVE;
	}
	return employeeProfileRepository.updateById(profile.id, { $set: patch });
}

export { formatHoursMinutes, dayKey, startOfDay, endOfDay };

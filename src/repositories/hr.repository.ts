import EmployeeProfile from "@models/employeeProfile.model";
import Shift from "@models/shift.model";
import Holiday from "@models/holiday.model";
import AttendanceRecord from "@models/attendanceRecord.model";
import AttendancePunch from "@models/attendancePunch.model";
import AttendanceSettings from "@models/attendanceSettings.model";
import { LeaveType, LeaveBalance, LeaveRequest } from "@models/leave.model";
import AttendanceCorrection from "@models/attendanceCorrection.model";
import { AttendanceMonthLock, AttendanceAuditLog } from "@models/attendanceMeta.model";
import { BaseRepository } from "./BaseRepository";

export class EmployeeProfileRepository extends BaseRepository {
	constructor() {
		super(EmployeeProfile, true);
	}
}
export class ShiftRepository extends BaseRepository {
	constructor() {
		super(Shift, true);
	}
}
export class HolidayRepository extends BaseRepository {
	constructor() {
		super(Holiday, true);
	}
}
export class AttendanceRecordRepository extends BaseRepository {
	constructor() {
		super(AttendanceRecord, true);
	}
}
export class AttendancePunchRepository extends BaseRepository {
	constructor() {
		super(AttendancePunch, true);
	}
}
export class AttendanceSettingsRepository extends BaseRepository {
	constructor() {
		super(AttendanceSettings, true);
	}
}
export class LeaveTypeRepository extends BaseRepository {
	constructor() {
		super(LeaveType, true);
	}
}
export class LeaveBalanceRepository extends BaseRepository {
	constructor() {
		super(LeaveBalance, true);
	}
}
export class LeaveRequestRepository extends BaseRepository {
	constructor() {
		super(LeaveRequest, true);
	}
}
export class AttendanceCorrectionRepository extends BaseRepository {
	constructor() {
		super(AttendanceCorrection, true);
	}
}
export class AttendanceMonthLockRepository extends BaseRepository {
	constructor() {
		super(AttendanceMonthLock, true);
	}
}
export class AttendanceAuditLogRepository extends BaseRepository {
	constructor() {
		super(AttendanceAuditLog, true);
	}
}

export const employeeProfileRepository = new EmployeeProfileRepository();
export const shiftRepository = new ShiftRepository();
export const holidayRepository = new HolidayRepository();
export const attendanceRecordRepository = new AttendanceRecordRepository();
export const attendancePunchRepository = new AttendancePunchRepository();
export const attendanceSettingsRepository = new AttendanceSettingsRepository();
export const leaveTypeRepository = new LeaveTypeRepository();
export const leaveBalanceRepository = new LeaveBalanceRepository();
export const leaveRequestRepository = new LeaveRequestRepository();
export const attendanceCorrectionRepository = new AttendanceCorrectionRepository();
export const attendanceMonthLockRepository = new AttendanceMonthLockRepository();
export const attendanceAuditLogRepository = new AttendanceAuditLogRepository();

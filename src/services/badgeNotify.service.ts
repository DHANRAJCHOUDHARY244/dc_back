import { SOCKET_EVENTS } from "@constants/socket.constants";
import { SocketService } from "@services/socket.service";

let lastSlaFingerprint = "";

export type SlaBadgeSummary = {
	total_delayed: number;
	critical?: number;
	delayed?: number;
	warning?: number;
	on_track?: number;
};

/** Tell clients to refetch master-task badge counts (summary is per-user). */
export function notifyMasterTaskBadgeChanged() {
	SocketService.emit(SOCKET_EVENTS.BADGE_MASTER_TASKS, { refresh: true });
}

/** Push SLA delay summary when counts change (same for all managers). */
export function notifySlaBadgeChanged(summary: SlaBadgeSummary) {
	const fingerprint = [
		summary.total_delayed,
		summary.critical ?? 0,
		summary.delayed ?? 0,
		summary.warning ?? 0,
	].join(":");
	if (fingerprint === lastSlaFingerprint) return;
	lastSlaFingerprint = fingerprint;
	SocketService.emit(SOCKET_EVENTS.BADGE_SLA_DELAYS, summary);
}

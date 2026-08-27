import logger from "@utils/pino";
import { CronEngine } from "./cron-engine.service";
import { DAILY, HOURLY, MINUTE, MORNING, NIGHT } from "@constants/cron.constants";
import quotesController from "@controllers/quotes.controller";
import { runLeadSupervisor } from "@services/leadWorkflow.service";
import { finalizeMissingAbsents } from "@services/hrAttendance.service";
import { evaluateOpenRuns, ensureSlaSeeds, backfillActiveQuotes } from "@services/sla.service";
import {
	evaluateTaskEscalations,
	markMissedFollowUps,
	ensureMasterTaskSeeds,
} from "@services/masterTask.service";

export const loadCrons = () => {
	CronEngine.register({
		name: "daily-midnight",
		schedule: DAILY.MIDNIGHT,
		functions: [
			quotesController.markDeadQuotesCron,
			() => {
				void finalizeMissingAbsents(new Date(Date.now() - 86400000));
			},
		],
		enabled: true,
	});

	CronEngine.register({
		name: "daily-noon",
		schedule: DAILY.NOON,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "daily-evening",
		schedule: DAILY.EVENING,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "hourly-every-hour",
		schedule: HOURLY.EVERY_HOUR,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "hourly-half-hour",
		schedule: HOURLY.HALF_HOUR,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "hourly-quarter-hour",
		schedule: HOURLY.QUARTER_HOUR,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "sla-every-5-min",
		schedule: MINUTE.EVERY_5_MIN,
		functions: [
			() => {
				void evaluateOpenRuns().catch((e) => logger.error(`SLA evaluate: ${e?.message || e}`));
			},
			() => {
				void evaluateTaskEscalations().catch((e) =>
					logger.error(`Task escalation: ${e?.message || e}`),
				);
			},
			() => {
				void markMissedFollowUps().catch((e) =>
					logger.error(`Missed follow-ups: ${e?.message || e}`),
				);
			},
			() => {
				void runLeadSupervisor({ hours: 2 }).catch((e) =>
					logger.error(`Lead supervisor: ${e?.message || e}`),
				);
			},
		],
		enabled: true,
	});

	CronEngine.register({
		name: "morning-7am",
		schedule: MORNING.AM_7,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "morning-9am",
		schedule: MORNING.AM_9,
		functions: [
			() => {
				void runLeadSupervisor({ hours: 24 });
			},
			() => {
				void (async () => {
					await ensureSlaSeeds();
					await backfillActiveQuotes();
					await evaluateOpenRuns();
					await ensureMasterTaskSeeds();
					await evaluateTaskEscalations();
					await markMissedFollowUps();
				})().catch((e) => logger.error(`Morning SLA/tasks: ${e?.message || e}`));
			},
		],
		enabled: true,
	});

	CronEngine.register({
		name: "night-8pm",
		schedule: NIGHT.PM_8,
		functions: [],
		enabled: false,
	});

	CronEngine.register({
		name: "night-11pm",
		schedule: NIGHT.PM_11,
		functions: [],
		enabled: false,
	});

	logger.info(`Cron Jobs Loaded: ${CronEngine.list()}`);
};

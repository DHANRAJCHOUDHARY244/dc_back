import logger from "@utils/pino";
import { CronEngine } from "./cron-engine.service";
import { DAILY, HOURLY, MINUTE, MORNING, NIGHT } from "@constants/cron.constants";
import quotesController from "@controllers/quotes.controller";
import { deleteOldLogsCron } from "@utils/logSaver";
import { runLeadSupervisor } from "@services/leadWorkflow.service";

export const loadCrons = () => {
  
  // DAILY
  CronEngine.register({
    name: "daily-midnight",
    schedule: DAILY.MIDNIGHT,
    functions: [quotesController.markDeadQuotesCron,deleteOldLogsCron],
    enabled: true
  });

  CronEngine.register({
    name: "daily-noon",
    schedule: DAILY.NOON,
    functions: [],
    enabled: false
  });

  CronEngine.register({
    name: "daily-evening",
    schedule: DAILY.EVENING,
    functions: [],
    enabled: false
  });

  // HOURLY
  CronEngine.register({
    name: "hourly-every-hour",
    schedule: HOURLY.EVERY_HOUR,
    functions: [deleteOldLogsCron],
    enabled: false
  });

  CronEngine.register({
    name: "hourly-half-hour",
    schedule: HOURLY.HALF_HOUR,
    functions: [],
    enabled: false
  });

  CronEngine.register({
    name: "hourly-quarter-hour",
    schedule: HOURLY.QUARTER_HOUR,
    functions: [],
    enabled: false
  });

  // MORNING
  CronEngine.register({
    name: "morning-7am",
    schedule: MORNING.AM_7,
    functions: [],
    enabled: false
  });

  CronEngine.register({
    name: "morning-9am",
    schedule: MORNING.AM_9,
    functions: [
      () => {
        void runLeadSupervisor({ hours: 24 });
      },
    ],
    enabled: true,
  });

  // NIGHT
  CronEngine.register({
    name: "night-8pm",
    schedule: NIGHT.PM_8,
    functions: [],
    enabled: false
  });

  CronEngine.register({
    name: "night-11pm",
    schedule: NIGHT.PM_11,
    functions: [],
    enabled: false
  });

  logger.info(`Cron Jobs Loaded: ${CronEngine.list()}`);
};

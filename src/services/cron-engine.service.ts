import cron, { ScheduledTask } from "node-cron";
import { tryWithRedisLock } from "@services/redisLock.service";

export interface CronConfig {
  name: string;
  schedule: string;
  functions: Array<() => Promise<void> | void>;
  enabled?: boolean;
}

/** Prevent PM2 cluster workers from running the same cron job in parallel. */
const CRON_LOCK_TTL_MS = 10 * 60 * 1000;

export class CronEngine {
  private static jobs: Map<string, ScheduledTask> = new Map();

  static register(config: CronConfig) {
    if (config.enabled === false) return;

    const task = cron.schedule(config.schedule, async () => {
      await tryWithRedisLock(`cron:${config.name}`, CRON_LOCK_TTL_MS, async () => {
        for (const fn of config.functions) {
          try {
            await fn();
          } catch {}
        }
      });
    });

    CronEngine.jobs.set(config.name, task);
  }

  static stop(name: string) {
    CronEngine.jobs.get(name)?.stop();
  }

  static start(name: string) {
    CronEngine.jobs.get(name)?.start();
  }

  static list() {
    return [...CronEngine.jobs.keys()];
  }
}

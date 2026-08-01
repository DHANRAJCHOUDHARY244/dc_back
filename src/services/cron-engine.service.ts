import cron, { ScheduledTask } from "node-cron";

export interface CronConfig {
  name: string;
  schedule: string;
  functions: Array<() => Promise<void> | void>;
  enabled?: boolean;
}

export class CronEngine {
  private static jobs: Map<string, ScheduledTask> = new Map();

  static register(config: CronConfig) {
    if (config.enabled === false) return;

    const task = cron.schedule(config.schedule, async () => {
      for (const fn of config.functions) {
        try {
          await fn();
        } catch {}
      }
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

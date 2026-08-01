import SystemLog from "@models/systemLog.model";
import { BaseRepository } from "./BaseRepository";

export class SystemLogRepository extends BaseRepository {
  constructor() {
    super(SystemLog, false);
  }
}

export const systemLogRepository = new SystemLogRepository();

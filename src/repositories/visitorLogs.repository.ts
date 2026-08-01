import VisitorLogs from "@models/visitorLogs.model";
import { BaseRepository } from "./BaseRepository";

export class VisitorLogsRepository extends BaseRepository {
  constructor() {
    super(VisitorLogs, true);
  }
}

export const visitorLogsRepository = new VisitorLogsRepository();

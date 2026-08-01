import Assessment from "@models/assessment.model";
import { BaseRepository } from "./BaseRepository";

export class AssessmentRepository extends BaseRepository {
  constructor() {
    super(Assessment, true);
  }
}

export const assessmentRepository = new AssessmentRepository();

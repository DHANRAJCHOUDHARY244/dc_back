import DuctedAssessment from "@models/ducted_assessment.model";
import { BaseRepository } from "./BaseRepository";

export class DuctedAssessmentRepository extends BaseRepository {
  constructor() {
    super(DuctedAssessment, false);
  }
}

export const ductedAssessmentRepository = new DuctedAssessmentRepository();

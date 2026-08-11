import {
	TrainingCategory,
	TrainingResource,
	TrainingCourse,
	TrainingAssignment,
	TrainingProgress,
	TrainingVersion,
	TrainingSettings,
} from "@models/training.model";
import { BaseRepository } from "./BaseRepository";

export class TrainingCategoryRepository extends BaseRepository {
	constructor() {
		super(TrainingCategory, true);
	}
}
export class TrainingResourceRepository extends BaseRepository {
	constructor() {
		super(TrainingResource, true);
	}
}
export class TrainingCourseRepository extends BaseRepository {
	constructor() {
		super(TrainingCourse, true);
	}
}
export class TrainingAssignmentRepository extends BaseRepository {
	constructor() {
		super(TrainingAssignment, true);
	}
}
export class TrainingProgressRepository extends BaseRepository {
	constructor() {
		super(TrainingProgress, true);
	}
}
export class TrainingVersionRepository extends BaseRepository {
	constructor() {
		super(TrainingVersion, false);
	}
}
export class TrainingSettingsRepository extends BaseRepository {
	constructor() {
		super(TrainingSettings, false);
	}
}

export const trainingCategoryRepository = new TrainingCategoryRepository();
export const trainingResourceRepository = new TrainingResourceRepository();
export const trainingCourseRepository = new TrainingCourseRepository();
export const trainingAssignmentRepository = new TrainingAssignmentRepository();
export const trainingProgressRepository = new TrainingProgressRepository();
export const trainingVersionRepository = new TrainingVersionRepository();
export const trainingSettingsRepository = new TrainingSettingsRepository();

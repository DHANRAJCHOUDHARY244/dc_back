import {
	FeedbackCase,
	FeedbackMessage,
	FeedbackInternalNote,
	FeedbackAuditLog,
	FeedbackSettings,
} from "@models/feedback.model";
import { BaseRepository } from "./BaseRepository";

export class FeedbackCaseRepository extends BaseRepository {
	constructor() {
		super(FeedbackCase, true);
	}
}
export class FeedbackMessageRepository extends BaseRepository {
	constructor() {
		super(FeedbackMessage, true);
	}
}
export class FeedbackInternalNoteRepository extends BaseRepository {
	constructor() {
		super(FeedbackInternalNote, true);
	}
}
export class FeedbackAuditLogRepository extends BaseRepository {
	constructor() {
		super(FeedbackAuditLog, false);
	}
}
export class FeedbackSettingsRepository extends BaseRepository {
	constructor() {
		super(FeedbackSettings, false);
	}
}

export const feedbackCaseRepository = new FeedbackCaseRepository();
export const feedbackMessageRepository = new FeedbackMessageRepository();
export const feedbackInternalNoteRepository = new FeedbackInternalNoteRepository();
export const feedbackAuditLogRepository = new FeedbackAuditLogRepository();
export const feedbackSettingsRepository = new FeedbackSettingsRepository();

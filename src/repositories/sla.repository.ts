import { SlaDelayReason, SlaStageConfig, SlaStageRun } from "@models/sla.model";
import { BaseRepository } from "./BaseRepository";

export class SlaStageConfigRepository extends BaseRepository {
	constructor() {
		super(SlaStageConfig, true);
	}
}

export class SlaDelayReasonRepository extends BaseRepository {
	constructor() {
		super(SlaDelayReason, true);
	}
}

export class SlaStageRunRepository extends BaseRepository {
	constructor() {
		super(SlaStageRun, true);
	}
}

export const slaStageConfigRepository = new SlaStageConfigRepository();
export const slaDelayReasonRepository = new SlaDelayReasonRepository();
export const slaStageRunRepository = new SlaStageRunRepository();

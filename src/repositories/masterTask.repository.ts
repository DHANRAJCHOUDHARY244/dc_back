import { TaskTypeCatalog, EscalationRule, CrmFollowUp } from "@models/masterTask.model";
import { BaseRepository } from "./BaseRepository";

export class TaskTypeCatalogRepository extends BaseRepository {
	constructor() {
		super(TaskTypeCatalog, true);
	}
}

export class EscalationRuleRepository extends BaseRepository {
	constructor() {
		super(EscalationRule, true);
	}
}

export class CrmFollowUpRepository extends BaseRepository {
	constructor() {
		super(CrmFollowUp, true);
	}
}

export const taskTypeCatalogRepository = new TaskTypeCatalogRepository();
export const escalationRuleRepository = new EscalationRuleRepository();
export const crmFollowUpRepository = new CrmFollowUpRepository();

import LeadAgent from "@models/leadAgent.model";
import LeadServiceArea from "@models/leadServiceArea.model";
import LeadDistributionSettings from "@models/leadDistributionSettings.model";
import { BaseRepository } from "./BaseRepository";

export class LeadAgentRepository extends BaseRepository {
	constructor() {
		super(LeadAgent, true);
	}
}
export const leadAgentRepository = new LeadAgentRepository();

export class LeadServiceAreaRepository extends BaseRepository {
	constructor() {
		super(LeadServiceArea, true);
	}
}
export const leadServiceAreaRepository = new LeadServiceAreaRepository();

export class LeadDistributionSettingsRepository extends BaseRepository {
	constructor() {
		super(LeadDistributionSettings, true);
	}
}
export const leadDistributionSettingsRepository = new LeadDistributionSettingsRepository();

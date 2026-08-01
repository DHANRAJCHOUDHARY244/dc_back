import CrmCompanyUnit from "@models/crmCompanyUnit.model";
import { BaseRepository } from "./BaseRepository";

export class CrmCompanyUnitRepository extends BaseRepository {
	constructor() {
		super(CrmCompanyUnit, true);
	}
}

export const crmCompanyUnitRepository = new CrmCompanyUnitRepository();

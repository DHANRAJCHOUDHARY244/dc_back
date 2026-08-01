import AllInOneJob from "@models/allInOneJob.model";
import { BaseRepository } from "./BaseRepository";

export class AllInOneJobRepository extends BaseRepository {
	constructor() {
		super(AllInOneJob, true);
	}
}

export const allInOneJobRepository = new AllInOneJobRepository();

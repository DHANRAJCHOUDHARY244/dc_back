import type {
  Model,
  PipelineStage,
  PopulateOptions,
  QueryFilter,
  UpdateQuery,
} from "mongoose";

export type FindOptions = {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  select?: string | Record<string, 0 | 1>;
  populate?: string | PopulateOptions | PopulateOptions[];
  lean?: boolean;
};

export type PaginateOptions = FindOptions & {
  page?: number;
};

/** Mongoose 9–compatible base repository (loose model typing for schema-inferred models) */
export class BaseRepository {
  constructor(
    protected readonly model: Model<any>,
    protected readonly paranoid = false,
  ) {}

  protected filter(extra: QueryFilter<Record<string, unknown>> = {}): QueryFilter<Record<string, unknown>> {
    if (!this.paranoid) return extra;
    return { ...extra, deleted_at: null };
  }

  findById(id: number, options?: FindOptions) {
    return this.findOne({ id }, options);
  }

  findOne(filter: QueryFilter<Record<string, unknown>>, options?: FindOptions) {
    let q = this.model.findOne(this.filter(filter));
    q = this.applyOptions(q, options);
    return q;
  }

  find(filter: QueryFilter<Record<string, unknown>> = {}, options?: FindOptions) {
    let q = this.model.find(this.filter(filter));
    q = this.applyOptions(q, options);
    return q;
  }

  create(data: Record<string, unknown>) {
    return this.model.create(data);
  }

  async createMany(data: Record<string, unknown>[]) {
    const docs: Record<string, unknown>[] = [];
    for (const item of data) {
      docs.push(await this.create(item));
    }
    return docs;
  }

  async updateById(id: number, data: UpdateQuery<Record<string, unknown>>) {
    return this.model.findOneAndUpdate(this.filter({ id }), data, { returnDocument: "after" });
  }

  async updateOne(filter: QueryFilter<Record<string, unknown>>, data: UpdateQuery<Record<string, unknown>>) {
    return this.model.findOneAndUpdate(this.filter(filter), data, { returnDocument: "after" });
  }

  async updateMany(filter: QueryFilter<Record<string, unknown>>, data: UpdateQuery<Record<string, unknown>>) {
    return this.model.updateMany(this.filter(filter), data);
  }

  async softDeleteById(id: number) {
    if (!this.paranoid) return this.model.findOneAndDelete({ id });
    return this.model.findOneAndUpdate(
      this.filter({ id }),
      { $set: { deleted_at: new Date() } },
      { returnDocument: "after" },
    );
  }

  async deleteById(id: number) {
    return this.softDeleteById(id);
  }

  async deleteOne(filter: QueryFilter<Record<string, unknown>>) {
    if (!this.paranoid) return this.model.findOneAndDelete(this.filter(filter));
    return this.model.findOneAndUpdate(
      this.filter(filter),
      { $set: { deleted_at: new Date() } },
      { returnDocument: "after" },
    );
  }

  async softDeleteMany(filter: QueryFilter<Record<string, unknown>>) {
    if (!this.paranoid) return this.model.deleteMany(filter);
    return this.model.updateMany(this.filter(filter), { $set: { deleted_at: new Date() } });
  }

  async deleteMany(filter: QueryFilter<Record<string, unknown>>) {
    return this.softDeleteMany(filter);
  }

  count(filter: QueryFilter<Record<string, unknown>> = {}) {
    return this.model.countDocuments(this.filter(filter));
  }

  async findPaginated(
    filter: QueryFilter<Record<string, unknown>> = {},
    options: PaginateOptions = {},
  ) {
    const { page = 1, limit = 10, skip, ...findOptions } = options;
    const resolvedSkip = skip ?? (page - 1) * limit;
    const [rows, count] = await Promise.all([
      this.find(filter, { ...findOptions, skip: resolvedSkip, limit }).exec(),
      this.count(filter),
    ]);
    return { rows, count };
  }

  async findOrCreate(
    filter: QueryFilter<Record<string, unknown>>,
    defaults: Record<string, unknown> = {},
  ) {
    const existing = await this.findOne(filter);
    if (existing) return { doc: existing, created: false };
    const doc = await this.create({ ...filter, ...defaults });
    return { doc, created: true };
  }

  aggregate(pipeline: PipelineStage[]) {
    const stages: PipelineStage[] = this.paranoid
      ? [{ $match: { deleted_at: null } }, ...pipeline]
      : pipeline;
    return this.model.aggregate(stages);
  }

  aggregateRaw(pipeline: PipelineStage[]) {
    return this.model.aggregate(pipeline);
  }

  get collection() {
    return this.model.collection;
  }

  private applyOptions<Q>(query: Q, options?: FindOptions): Q {
    if (!options) return query;
    const q = query as any;
    if (options.sort) q.sort(options.sort);
    if (options.skip != null) q.skip(options.skip);
    if (options.limit != null) q.limit(options.limit);
    if (options.select) q.select(options.select);
    if (options.populate) q.populate(options.populate);
    if (options.lean) q.lean();
    return query;
  }
}

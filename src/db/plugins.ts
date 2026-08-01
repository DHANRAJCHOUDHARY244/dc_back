import { Schema, type SchemaOptions } from "mongoose";
import { getNextSequence } from "./counter.model";

/** Legacy snake_case timestamp fields */
export const timestamps = {
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

const serializeOptions = {
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
} as const;

/** Standard schema options — BSON-native, no stringify */
export function collectionOptions(collection: string): SchemaOptions {
  return { collection, timestamps, ...serializeOptions };
}

/** Native BSON array (never stored as a JSON string) */
export const jsonArray = {
  type: [Schema.Types.Mixed],
  default: () => [],
};

/** Native BSON object */
export const jsonObject = {
  type: Schema.Types.Mixed,
  default: () => ({}),
};

export function applyNumericId(schema: Schema, collection: string): void {
  schema.pre("save", async function () {
    if (this.isNew && this.get("id") == null) {
      this.set("id", await getNextSequence(collection));
    }
  });
}

export function applySoftDelete(schema: Schema): void {
  schema.add({ deleted_at: { type: Date, default: null } });
}

export type ModelPluginOptions = {
  collection: string;
  paranoid?: boolean;
  /** Set false when `id` is not auto-incremented (e.g. UUID string) */
  numericId?: boolean;
};

export function applyBasePlugins(schema: Schema, options: ModelPluginOptions): void {
  if (options.paranoid) applySoftDelete(schema);
  if (options.numericId !== false) applyNumericId(schema, options.collection);
}

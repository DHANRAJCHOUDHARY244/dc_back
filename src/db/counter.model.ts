import mongoose, { Schema, model } from "mongoose";

const CounterSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter =
  mongoose.models.Counter ?? model("Counter", CounterSchema, "counters");

export async function getNextSequence(name: string): Promise<number> {
  const doc = await Counter.collection.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  return (doc as { seq?: number } | null)?.seq ?? 1;
}

/** Align counter with max numeric `id` in a collection (fixes E11000 after manual DB edits). */
export async function syncSequenceFromMax(
  counterName: string,
  maxId: number,
): Promise<void> {
  if (!Number.isFinite(maxId) || maxId < 0) return;
  await Counter.collection.updateOne(
    { name: counterName },
    { $max: { seq: maxId } },
    { upsert: true },
  );
}

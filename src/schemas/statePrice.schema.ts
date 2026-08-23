import { Schema } from "mongoose";
import { emptyStatePrice } from "@constants/auStatePrice.constants";

export const StatePriceSchema = new Schema(
  {
    vic: { type: Number, default: 0 },
    nsw: { type: Number, default: 0 },
    act: { type: Number, default: 0 },
    qld: { type: Number, default: 0 },
    sa: { type: Number, default: 0 },
    wa: { type: Number, default: 0 },
    tas: { type: Number, default: 0 },
    nt: { type: Number, default: 0 },
  },
  { _id: false },
);

export const emptySp = () => emptyStatePrice(0);

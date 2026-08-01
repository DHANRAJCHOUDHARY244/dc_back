import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { DEFAULT_INSTALLATION_TYPES } from "@constants/categoryMeta";

const QuoteBuilderSettingsSchema = new Schema(
  {
    id: { type: Number, unique: true, default: 1 },
    installation_types: {
      type: [
        {
          value: { type: String, required: true },
          label: { type: String, required: true },
          _id: false,
        },
      ],
      default: () => DEFAULT_INSTALLATION_TYPES,
    },
  },
  collectionOptions("quote_builder_settings"),
);

applyBasePlugins(QuoteBuilderSettingsSchema, { collection: "quote_builder_settings", paranoid: false });

const QuoteBuilderSettings =
  mongoose.models.QuoteBuilderSettings ?? mongoose.model("QuoteBuilderSettings", QuoteBuilderSettingsSchema);
export default QuoteBuilderSettings;

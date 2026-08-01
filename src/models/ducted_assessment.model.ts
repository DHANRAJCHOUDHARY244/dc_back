import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const DuctedAssessmentSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    type: { type: String },
    cf_id: { type: Number },
    cust_id: { type: Number },
    customer: { type: String },
    address: { type: String },
    email: { type: String },
    mobile: { type: String },
    date: { type: String },
    time: { type: String },
    assessor: { type: String },
    stories: { type: String },
    buildingType: { type: String },
    construction: { type: String },
    property_age: { type: String },
    roof_type: { type: String },
    ceiling_height: { type: String },
    circuit_breaker_spaces: { type: String },
    switch_rating: { type: String },
    phase_type: { type: String },
    distance: { type: Number },
    switchboard_photo: jsonArray,
    vents_total: { type: Number },
    return_air: { type: String },
    zone_controller: { type: String },
    room: { type: String },
    ventType: { type: String },
    outdoorLocation: { type: String },
    groundSurface: { type: String },
    levelSurface: { type: String },
    spaceAvailable: { type: String },
    outdoorPhotos: jsonArray,
    roofAccess: { type: String },
    ceilingSpace: { type: String },
    vehicleAccess: { type: String },
    noise: { type: String },
    ducting: { type: String },
    ductingNotes: { type: String },
    notes: { type: String },
    agree: { type: Boolean },
    customerSignature: { type: String },
    assessorSignature: { type: String },
    token: { type: String },
  },
  collectionOptions("ducted_assessments"),
);

DuctedAssessmentSchema.virtual("customerDetails", {
  ref: "User",
  localField: "cust_id",
  foreignField: "id",
  justOne: true,
});
DuctedAssessmentSchema.virtual("cf", {
  ref: "ContactForm",
  localField: "cf_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(DuctedAssessmentSchema, { collection: "ducted_assessments", paranoid: false });

const DuctedAssessment =
  mongoose.models.DuctedAssessment ?? mongoose.model("DuctedAssessment", DuctedAssessmentSchema);
export default DuctedAssessment;

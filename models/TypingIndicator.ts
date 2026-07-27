import mongoose, { Schema, models, model } from "mongoose";

const TypingIndicatorSchema = new Schema({
  scopeType: { type: String, enum: ["group", "dm"], required: true },
  scopeId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedAt: { type: Date, default: Date.now },
});

TypingIndicatorSchema.index({ scopeType: 1, scopeId: 1, userId: 1 }, { unique: true });
// ponytail: TTL cleanup is a background sweep (~60s cadence), not instant — reads still
// filter by a recent-updatedAt window themselves, so correctness never depends on the sweep timing.
TypingIndicatorSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 10 });

export default models.TypingIndicator || model("TypingIndicator", TypingIndicatorSchema);

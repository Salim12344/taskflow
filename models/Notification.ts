import mongoose, { Schema, models, model } from "mongoose";

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  text: { type: String, required: true }, // human-readable, computed at creation time — no join needed to display
  description: { type: String, default: null }, // optional preview snippet, e.g. the task description
  payload: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = mongoose.InferSchemaType<typeof NotificationSchema> & { _id: mongoose.Types.ObjectId };

export default models.Notification || model("Notification", NotificationSchema);

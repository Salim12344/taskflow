import mongoose, { Schema, models, model } from "mongoose";

const PushSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});

export type PushSubscriptionDoc = mongoose.InferSchemaType<typeof PushSubscriptionSchema> & { _id: mongoose.Types.ObjectId };

export default models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);

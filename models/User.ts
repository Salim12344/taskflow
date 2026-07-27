import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String }, // absent for Google-only accounts
  name: { type: String, required: true },
  avatarUrl: { type: String, default: null }, // data URI, resized client-side before upload
  accountType: { type: String, enum: ["individual", "organization"], required: true },
  lastActiveAt: { type: Date, default: null },
  showOnlineStatus: { type: Boolean, default: true }, // WhatsApp-style privacy toggle
  createdAt: { type: Date, default: Date.now },
});

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export default models.User || model("User", UserSchema);

import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String }, // absent for Google-only accounts
  name: { type: String, required: true },
  avatarUrl: { type: String, default: null }, // data URI, resized client-side before upload
  accountType: { type: String, enum: ["individual", "organization"], required: true },
  // Set when this account joined via an org's signup key — separate from owning an org
  // (Organization.ownerId) and from being added to any specific group.
  orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
  // Only meaningful when orgId is set: a key alone isn't proof of identity, so a key-joiner
  // can't touch the app until an admin approves them.
  signupStatus: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" },
  // Org owner can suspend or ban someone's whole account (not just remove them from a group) —
  // both block login everywhere; banning additionally blocks that email from rejoining this org.
  orgStatus: { type: String, enum: ["active", "suspended", "banned"], default: "active" },
  orgStatusReason: { type: String, default: null },
  // Org-wide extras the owner can grant an admin, on top of their normal per-group admin rights.
  // Exactly these three — no open-ended/custom permissions.
  orgPermissions: [{ type: String, enum: ["view_all_tasks", "org_override", "approve_signups"] }],
  lastActiveAt: { type: Date, default: null },
  showOnlineStatus: { type: Boolean, default: true }, // WhatsApp-style privacy toggle
  createdAt: { type: Date, default: Date.now },
});

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export default models.User || model("User", UserSchema);

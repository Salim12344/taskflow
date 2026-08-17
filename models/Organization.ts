import mongoose, { Schema, models, model } from "mongoose";

const OrganizationSchema = new Schema({
  name: { type: String, required: true },
  regNumber: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{6}$/,
  },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // A 6-digit PIN the owner hands out so new hires can self-serve onto the org at signup —
  // deliberately separate from regNumber (the business registration ID), which isn't a secret.
  signupKey: {
    type: String,
    unique: true,
    sparse: true,
    match: /^\d{6}$/,
  },
  // Emails banned from ever joining this org via the signup key again — kept independent of any
  // particular User record so a ban still means something even if the account is later removed.
  bannedEmails: [{ type: String, lowercase: true }],
  createdAt: { type: Date, default: Date.now },
});

export type OrganizationDoc = mongoose.InferSchemaType<typeof OrganizationSchema> & { _id: mongoose.Types.ObjectId };

export default models.Organization || model("Organization", OrganizationSchema);

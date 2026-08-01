import mongoose, { Schema, models, model } from "mongoose";

const DMMessageSchema = new Schema({
  threadId: { type: Schema.Types.ObjectId, ref: "DMThread", required: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // Not required: an attachment-only message (voice note, photo) has no text at all.
  text: { type: String, default: "" },
  attachments: [
    {
      url: { type: String, required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      size: { type: Number, required: true },
    },
  ],
  replyTo: {
    type: {
      messageId: { type: Schema.Types.ObjectId, required: true },
      text: { type: String, required: true },
      senderName: { type: String, required: true },
    },
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date, default: null },
  // "Delete for me" only — hides the message from this user's own view without touching the other side's copy.
  deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

DMMessageSchema.index({ threadId: 1, createdAt: 1 });

export type DMMessageDoc = mongoose.InferSchemaType<typeof DMMessageSchema> & { _id: mongoose.Types.ObjectId };

export default models.DMMessage || model("DMMessage", DMMessageSchema);

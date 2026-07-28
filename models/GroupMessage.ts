import mongoose, { Schema, models, model } from "mongoose";

const GroupMessageSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true },
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
  mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
  // Denormalized at write time (same pattern as Notification) so rendering a reply never
  // needs a join, even if the original message later gets edited or deleted.
  replyTo: {
    type: {
      messageId: { type: Schema.Types.ObjectId, required: true },
      text: { type: String, required: true },
      senderName: { type: String, required: true },
    },
    default: null,
  },
  readBy: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      readAt: { type: Date, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  isSystemMessage: { type: Boolean, default: false },
});

GroupMessageSchema.index({ groupId: 1, createdAt: 1 });

export type GroupMessageDoc = mongoose.InferSchemaType<typeof GroupMessageSchema> & { _id: mongoose.Types.ObjectId };

export default models.GroupMessage || model("GroupMessage", GroupMessageSchema);

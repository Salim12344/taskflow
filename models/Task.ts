import mongoose, { Schema, models, model } from "mongoose";

const TaskSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["todo", "in_progress", "pending_review", "done"],
    default: "todo",
  },
  rejectionHistory: [
    {
      reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      reason: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  deadline: { type: Date, default: null },
  submittedAt: { type: Date, default: null }, // set when status -> pending_review, used to sort the review queue oldest-first
  // Once accepted, only this admin may approve/reject — null means any group admin can (default, unchanged behavior).
  reviewerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  // An outstanding request to hand off review responsibility; nothing transfers until the target admin accepts.
  pendingReviewDelegation: {
    type: {
      toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
    },
    default: null,
  },
  recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
  subtasks: [
    {
      text: { type: String, required: true },
      done: { type: Boolean, default: false },
    },
  ],
  attachments: [
    {
      url: { type: String, required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      size: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  // Guards the deadline-reminder cron from notifying the same task twice.
  deadlineReminderSentAt: { type: Date, default: null },
}, {
  // Rejects a save() if the doc changed underneath it since it was loaded (not just on array
  // edits, which is Mongoose's default) — prevents two concurrent edits from silently
  // last-write-winning over each other.
  optimisticConcurrency: true,
});

export type TaskDoc = mongoose.InferSchemaType<typeof TaskSchema> & { _id: mongoose.Types.ObjectId };

export default models.Task || model("Task", TaskSchema);

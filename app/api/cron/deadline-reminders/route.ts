import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { notify } from "@/lib/notify";

/** Runs daily via Vercel Cron (see vercel.json) — nudges assignees about tasks due within 24h. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dueSoon = await Task.find({
    deadline: { $ne: null, $lte: in24h, $gte: new Date() },
    status: { $ne: "done" },
    assignedTo: { $ne: null },
    deletedAt: null,
    deadlineReminderSentAt: null,
  });

  for (const task of dueSoon) {
    await notify(
      task.assignedTo!.toString(),
      "deadline_reminder",
      `"${task.title}" is due soon`,
      { description: `Due ${new Date(task.deadline!).toLocaleString()}`, payload: { taskId: task._id } }
    );
    task.deadlineReminderSentAt = new Date();
    await task.save();
  }

  return NextResponse.json({ remindersSent: dueSoon.length });
}

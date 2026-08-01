import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import DMThread from "@/models/DMThread";
import DMMessage from "@/models/DMMessage";

/** "Delete for me" — hides the message from this participant's own view only, not the other side's. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ threadId: string; messageId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, messageId } = await params;
  await connectDB();
  const thread = await DMThread.findById(threadId);
  if (!thread || !thread.participantIds.some((p: Types.ObjectId) => p.toString() === session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await DMMessage.updateOne({ _id: messageId, threadId }, { $addToSet: { deletedFor: session.user.id } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import DMThread from "@/models/DMThread";
import DMMessage from "@/models/DMMessage";
import { getTypingUsers } from "@/lib/typing";

async function requireParticipant(threadId: string, userId: string) {
  const thread = await DMThread.findById(threadId);
  if (!thread) return null;
  if (!thread.participantIds.some((p: Types.ObjectId) => p.toString() === userId)) return null;
  return thread;
}

export async function GET(_req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  await connectDB();
  const thread = await requireParticipant(threadId, session.user.id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await DMMessage.find({ threadId }).sort({ createdAt: 1 });

  await DMMessage.updateMany(
    { threadId, senderId: { $ne: session.user.id }, readAt: null },
    { $set: { readAt: new Date() } }
  );

  const typingUsers = await getTypingUsers("dm", threadId, session.user.id);
  return NextResponse.json({ messages, otherTyping: typingUsers.length > 0 });
}

export async function POST(req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  await connectDB();
  const thread = await requireParticipant(threadId, session.user.id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await DMMessage.create({ threadId, senderId: session.user.id, text: text.trim() });
  thread.lastMessageAt = new Date();
  await thread.save();

  return NextResponse.json({ message }, { status: 201 });
}

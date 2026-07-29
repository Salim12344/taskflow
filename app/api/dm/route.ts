import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import DMThread from "@/models/DMThread";
import DMMessage from "@/models/DMMessage";
import User from "@/models/User";
import { shareAGroup } from "@/lib/permissions";
import { maskPresence } from "@/lib/presence";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const threads = await DMThread.find({ participantIds: session.user.id }).sort({ lastMessageAt: -1 });

  const enriched = await Promise.all(
    threads.map(async (t) => {
      const otherId = t.participantIds.find((p: Types.ObjectId) => p.toString() !== session.user.id);
      const other = otherId ? await User.findById(otherId, "name email avatarUrl lastActiveAt showOnlineStatus") : null;
      const lastMessage = await DMMessage.findOne({ threadId: t._id }).sort({ createdAt: -1 });
      const unread = await DMMessage.countDocuments({ threadId: t._id, senderId: otherId, readAt: null });
      return {
        threadId: t._id,
        other: other ? { id: other._id, name: other.name, avatarUrl: other.avatarUrl, lastActiveAt: maskPresence(other) } : null,
        lastMessageAt: t.lastMessageAt,
        lastMessage: lastMessage ? { text: lastMessage.text, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt } : null,
        unread,
      };
    })
  );

  return NextResponse.json({ threads: enriched });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { otherUserId } = await req.json();
  if (!otherUserId) return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
  if (otherUserId === session.user.id) return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });

  await connectDB();
  // Org owners can message anyone — they're the one role with no natural "shared group"
  // boundary, since their oversight already spans every group under their org.
  const isOrgOwner = session.user.accountType === "organization";
  if (!isOrgOwner && !(await shareAGroup(session.user.id, otherUserId))) {
    return NextResponse.json({ error: "You can only message someone from a shared group's Members list" }, { status: 403 });
  }

  let thread = await DMThread.findOne({ participantIds: { $all: [session.user.id, otherUserId], $size: 2 } });
  if (!thread) {
    thread = await DMThread.create({ participantIds: [session.user.id, otherUserId], lastMessageAt: new Date() });
  }

  return NextResponse.json({ threadId: thread._id }, { status: 201 });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import GroupMessage from "@/models/GroupMessage";
import GroupMember from "@/models/GroupMember";
import Group from "@/models/Group";
import { isGroupMember } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";
import { getTypingUsers } from "@/lib/typing";

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  await connectDB();
  const activeGroup = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!activeGroup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isGroupMember(groupId, session.user.id, activeGroup.orgId?.toString() ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mark every message not already read by this viewer as read by them (aggregate "Seen by N" receipts).
  await GroupMessage.updateMany(
    { groupId, senderId: { $ne: session.user.id }, "readBy.userId": { $ne: session.user.id } },
    { $push: { readBy: { userId: session.user.id, readAt: new Date() } } }
  );

  const messages = await GroupMessage.find({ groupId })
    .sort({ createdAt: 1 })
    .populate("senderId", "name avatarUrl")
    .populate("readBy.userId", "name avatarUrl")
    .populate("mentions", "name");
  const typingUsers = await getTypingUsers("group", groupId, session.user.id);
  return NextResponse.json({ messages, typingUsers });
}

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const { text, mentions } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  await connectDB();
  const activeGroup = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!activeGroup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isGroupMember(groupId, session.user.id, activeGroup.orgId?.toString() ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only actual group members can be mentioned, and never yourself.
  const mentionIds: string[] = Array.isArray(mentions) ? [...new Set(mentions)].filter((id) => id !== session.user.id) : [];
  let validMentions: string[] = [];
  if (mentionIds.length > 0) {
    const validMembers = await GroupMember.find({ groupId, userId: { $in: mentionIds } }, "userId");
    validMentions = validMembers.map((m) => m.userId.toString());
  }

  const message = await GroupMessage.create({
    groupId,
    senderId: session.user.id,
    text: text.trim(),
    mentions: validMentions,
  });
  await message.populate("senderId", "name avatarUrl");
  await message.populate("mentions", "name");

  if (validMentions.length > 0) {
    const group = await Group.findById(groupId);
    await notifyMany(
      validMentions,
      "mention",
      `${session.user.name} mentioned you in ${group?.name ?? "a group"}`,
      { description: text.trim(), payload: { groupId, messageId: message._id } }
    );
  }

  return NextResponse.json({ message }, { status: 201 });
}

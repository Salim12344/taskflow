import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import GroupMessage from "@/models/GroupMessage";
import { isGroupMember } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  await connectDB();
  if (!(await isGroupMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await GroupMessage.find({ groupId }).sort({ createdAt: 1 }).populate("senderId", "name");
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  await connectDB();
  if (!(await isGroupMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await GroupMessage.create({
    groupId,
    senderId: session.user.id,
    text: text.trim(),
  });
  await message.populate("senderId", "name");

  return NextResponse.json({ message }, { status: 201 });
}

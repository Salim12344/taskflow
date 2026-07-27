import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import DMThread from "@/models/DMThread";
import { pingTyping } from "@/lib/typing";

export async function POST(_req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  await connectDB();
  const thread = await DMThread.findById(threadId);
  if (!thread || !thread.participantIds.some((p: Types.ObjectId) => p.toString() === session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await pingTyping("dm", threadId, session.user.id);
  return NextResponse.json({ ok: true });
}

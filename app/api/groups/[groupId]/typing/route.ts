import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import { isGroupMember } from "@/lib/permissions";
import { pingTyping } from "@/lib/typing";

export async function POST(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  await connectDB();
  const group = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isGroupMember(groupId, session.user.id, group.orgId?.toString() ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pingTyping("group", groupId, session.user.id);
  return NextResponse.json({ ok: true });
}

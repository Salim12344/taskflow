import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import { getCreatableOrg } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const memberships = await GroupMember.find({ userId: session.user.id });
  const groupIds = memberships.map((m) => m.groupId);
  const groups = await Group.find({ _id: { $in: groupIds }, deletedAt: null });

  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await connectDB();

  // Only the org's owner or a granted "group creator" may create groups — always under that org, never client-specified.
  const org = await getCreatableOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "You don't have permission to create a group. Ask your organization's admin." }, { status: 403 });
  }

  const group = await Group.create({
    name,
    orgId: org._id,
    createdBy: session.user.id,
  });
  await GroupMember.create({
    groupId: group._id,
    userId: session.user.id,
    role: "admin",
  });

  return NextResponse.json({ group }, { status: 201 });
}

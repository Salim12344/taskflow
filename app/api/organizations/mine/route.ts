import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import User from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const groups = await Group.find({ orgId: org._id, deletedAt: null });
  const pendingSignups = await User.find({ orgId: org._id, signupStatus: "pending" }, "name email createdAt");

  // "Belongs to the org" isn't just people who joined via the signup key (orgId set) — it's
  // also everyone added to one of the org's groups the old way, via a group invite link/email,
  // who never had orgId touched at all. Union both so nobody who's actually here goes missing.
  const groupIds = groups.map((g) => g._id.toString());
  const memberUserIds = await GroupMember.find({ groupId: { $in: groupIds } }, "userId").distinct("userId");
  const orgMembers = await User.find(
    {
      _id: { $ne: org.ownerId },
      $or: [{ orgId: org._id, signupStatus: "approved" }, { _id: { $in: memberUserIds } }],
    },
    "name email createdAt orgStatus orgPermissions"
  );

  return NextResponse.json(
    { organization: org, groups, pendingSignups, orgMembers },
    { headers: { "Cache-Control": "no-store" } }
  );
}

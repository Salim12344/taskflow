import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import User from "@/models/User";

// Temporary — remove after diagnosing the Org members undercount.
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.DEBUG_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const dbHost = mongoose.connection.host;
  const dbName = mongoose.connection.name;

  const org = await Organization.findOne({ name: "Nimbus Studios" });
  if (!org) return NextResponse.json({ dbHost, dbName, error: "org not found" });

  const groups = await Group.find({ orgId: org._id, deletedAt: null });
  const groupIds = groups.map((g) => g._id.toString());
  const memberUserIds = await GroupMember.find({ groupId: { $in: groupIds } }, "userId").distinct("userId");
  const orgMembers = await User.find(
    { _id: { $ne: org.ownerId }, $or: [{ orgId: org._id, signupStatus: "approved" }, { _id: { $in: memberUserIds } }] },
    "name email"
  );

  return NextResponse.json({
    dbHost,
    dbName,
    orgId: org._id.toString(),
    groupCount: groups.length,
    groupMemberRowCount: memberUserIds.length,
    orgMembersCount: orgMembers.length,
    orgMembers: orgMembers.map((u) => u.email),
  });
}

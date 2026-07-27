import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import Group from "@/models/Group";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id }).populate("groupCreators", "name email");
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const groups = await Group.find({ orgId: org._id, deletedAt: null });

  return NextResponse.json({ organization: org, groups });
}

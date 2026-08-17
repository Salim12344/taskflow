import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { hasOrgPermission } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const { approve } = await req.json();
  if (typeof approve !== "boolean") return NextResponse.json({ error: "approve must be a boolean" }, { status: 400 });

  await connectDB();
  let org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) {
    // Not the owner — allow through only if this admin was explicitly granted approve_signups.
    const actor = await User.findById(session.user.id, "orgId");
    if (actor?.orgId && (await hasOrgPermission(session.user.id, actor.orgId.toString(), "approve_signups"))) {
      org = await Organization.findById(actor.orgId);
    }
  }
  if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await User.findOne({ _id: userId, orgId: org._id, signupStatus: "pending" });
  if (!target) return NextResponse.json({ error: "No pending sign-up found for that user" }, { status: 404 });

  target.signupStatus = approve ? "approved" : "rejected";
  await target.save();

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import User from "@/models/User";

// ponytail: owner-only for now — extend the check once the admin permission checklist
// (approve_signups) exists, matching the org-owner-plus-permitted-admin spec.
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const { approve } = await req.json();
  if (typeof approve !== "boolean") return NextResponse.json({ error: "approve must be a boolean" }, { status: 400 });

  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const target = await User.findOne({ _id: userId, orgId: org._id, signupStatus: "pending" });
  if (!target) return NextResponse.json({ error: "No pending sign-up found for that user" }, { status: 404 });

  target.signupStatus = approve ? "approved" : "rejected";
  await target.save();

  return NextResponse.json({ ok: true });
}

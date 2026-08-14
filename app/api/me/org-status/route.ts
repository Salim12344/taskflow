import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";

/** Just the org name for the pending/rejected gate screens — session already carries signupStatus. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.orgId) return NextResponse.json({ orgName: null });

  await connectDB();
  const org = await Organization.findById(session.user.orgId, "name");
  return NextResponse.json({ orgName: org?.name ?? null });
}

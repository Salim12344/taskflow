import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import { generateSignupKey } from "@/lib/signup-key";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  org.signupKey = await generateSignupKey();
  await org.save();

  return NextResponse.json({ signupKey: org.signupKey });
}

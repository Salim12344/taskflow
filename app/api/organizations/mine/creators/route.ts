import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import User from "@/models/User";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return NextResponse.json({ error: "No account found with that email" }, { status: 404 });
  if (user._id.toString() === session.user.id) {
    return NextResponse.json({ error: "You already have full control of your organization" }, { status: 400 });
  }
  if (org.groupCreators.some((id: Types.ObjectId) => id.toString() === user._id.toString())) {
    return NextResponse.json({ error: "That person already has this permission" }, { status: 409 });
  }

  org.groupCreators.push(user._id);
  await org.save();
  await org.populate("groupCreators", "name email");

  return NextResponse.json({ organization: org }, { status: 201 });
}

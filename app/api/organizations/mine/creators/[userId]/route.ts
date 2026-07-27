import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  await connectDB();
  const org = await Organization.findOne({ ownerId: session.user.id });
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  org.groupCreators = org.groupCreators.filter((id: Types.ObjectId) => id.toString() !== userId);
  await org.save();

  return NextResponse.json({ ok: true });
}

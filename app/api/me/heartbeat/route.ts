import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// Called every ~30s by any open authenticated tab — deliberately cheap, no full doc load.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await User.updateOne({ _id: session.user.id }, { $set: { lastActiveAt: new Date() } });

  return NextResponse.json({ ok: true });
}

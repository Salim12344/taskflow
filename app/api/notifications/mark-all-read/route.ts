import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await Notification.updateMany({ userId: session.user.id, read: false }, { $set: { read: true } });

  return NextResponse.json({ ok: true });
}

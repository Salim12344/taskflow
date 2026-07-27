import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const notifications = await Notification.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ userId: session.user.id, read: false });

  return NextResponse.json({ notifications, unreadCount });
}

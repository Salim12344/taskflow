import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { read } = await req.json();

  await connectDB();
  const notification = await Notification.findOne({ _id: id, userId: session.user.id });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof read === "boolean") notification.read = read;
  await notification.save();

  return NextResponse.json({ notification });
}

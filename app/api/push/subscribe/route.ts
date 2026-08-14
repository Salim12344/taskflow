import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: session.user.id, endpoint, keys },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  await connectDB();
  await PushSubscription.deleteOne({ endpoint, userId: session.user.id });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

// Covers voice notes, photos, and typical documents without leaving the free tier wide open.
const MAX_SIZE = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large" }, { status: 400 });

  const blob = await put(`${session.user.id}/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return NextResponse.json({
    url: blob.url,
    name: file.name,
    type: file.type,
    size: file.size,
  });
}

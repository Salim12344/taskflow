import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import GroupMember from "@/models/GroupMember";
import Organization from "@/models/Organization";
import { getCreatableOrg } from "@/lib/permissions";

// ponytail: avatars stored as base64 data URIs on the user doc — fine at this size,
// move to Vercel Blob/S3 (store only the URL) if avatars need to scale past a few hundred users.
const MAX_AVATAR_BYTES = 300_000;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.user.id, "name email accountType avatarUrl showOnlineStatus");
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdminAnywhere =
    (await GroupMember.exists({ userId: session.user.id, role: "admin" })) != null ||
    (await Organization.exists({ ownerId: session.user.id })) != null;
  const canCreateGroups = (await getCreatableOrg(session.user.id)) != null;

  return NextResponse.json({ user, isAdminAnywhere, canCreateGroups });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, avatarUrl, showOnlineStatus } = await req.json();

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof name === "string" && name.trim()) user.name = name.trim();
  if (typeof showOnlineStatus === "boolean") user.showOnlineStatus = showOnlineStatus;

  if (avatarUrl !== undefined) {
    if (avatarUrl !== null) {
      if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "avatarUrl must be an image data URI" }, { status: 400 });
      }
      if (avatarUrl.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Image is too large — please use a smaller picture" }, { status: 400 });
      }
    }
    user.avatarUrl = avatarUrl;
  }

  await user.save();

  return NextResponse.json({
    user: {
      id: user._id, name: user.name, email: user.email, accountType: user.accountType,
      avatarUrl: user.avatarUrl, showOnlineStatus: user.showOnlineStatus,
    },
  });
}

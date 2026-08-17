import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { generateSignupKey } from "@/lib/signup-key";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, name, accountType, orgName, regNumber, joinKey } = body;

  if (!email || !password || !name || !accountType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["individual", "organization", "join"].includes(accountType)) {
    return NextResponse.json({ error: "Invalid accountType" }, { status: 400 });
  }
  if (accountType === "organization") {
    if (!orgName) {
      return NextResponse.json({ error: "orgName is required for organization accounts" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(regNumber ?? "")) {
      return NextResponse.json({ error: "regNumber must be exactly 6 digits" }, { status: 400 });
    }
  }
  if (accountType === "join" && !/^\d{6}$/.test(joinKey ?? "")) {
    return NextResponse.json({ error: "Organization key must be exactly 6 digits" }, { status: 400 });
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  if (accountType === "organization") {
    const existingOrg = await Organization.findOne({ regNumber });
    if (existingOrg) {
      return NextResponse.json({ error: "That registration number is already in use by another organization" }, { status: 409 });
    }
  }

  let joinOrg = null;
  if (accountType === "join") {
    joinOrg = await Organization.findOne({ signupKey: joinKey });
    if (!joinOrg) {
      return NextResponse.json({ error: "Invalid organization key" }, { status: 400 });
    }
    if (joinOrg.bannedEmails?.includes(email.toLowerCase())) {
      return NextResponse.json({ error: "This email is banned from joining this organization" }, { status: 403 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    name,
    // A key alone isn't identity verification, so this stays a plain "individual" account —
    // it must never inherit the implicit org-admin rights accountType: "organization" grants.
    accountType: accountType === "join" ? "individual" : accountType,
    orgId: joinOrg?._id ?? null,
    signupStatus: joinOrg ? "pending" : "approved",
  });

  let organization = null;
  if (accountType === "organization") {
    try {
      organization = await Organization.create({ name: orgName, regNumber, ownerId: user._id, signupKey: await generateSignupKey() });
    } catch (err) {
      await User.deleteOne({ _id: user._id });
      if (err instanceof Error && "code" in err && err.code === 11000) {
        return NextResponse.json({ error: "That registration number is already in use by another organization" }, { status: 409 });
      }
      throw err;
    }
  }

  return NextResponse.json(
    {
      user: { id: user._id, email: user.email, name: user.name, accountType: user.accountType, signupStatus: user.signupStatus },
      organization: organization ? { id: organization._id, name: organization.name } : null,
    },
    { status: 201 }
  );
}

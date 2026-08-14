import Organization from "@/models/Organization";

/** 6-digit numeric PIN, retried on the rare collision — same shape as regNumber but a separate namespace. */
export async function generateSignupKey(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const key = Math.floor(100000 + Math.random() * 900000).toString();
    if (!(await Organization.findOne({ signupKey: key }))) return key;
  }
  throw new Error("Could not generate a unique signup key");
}

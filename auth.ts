import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

class AccountSuspendedError extends CredentialsSignin {
  code = "account-suspended";
}
class AccountBannedError extends CredentialsSignin {
  code = "account-banned";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await connectDB();
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        if (user.orgStatus === "banned") throw new AccountBannedError();
        if (user.orgStatus === "suspended") throw new AccountSuspendedError();

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          signupStatus: user.signupStatus,
        };
      },
    }),
    Google,
  ],
  callbacks: {
    // Google sign-in always creates/attaches an Individual account (spec: no org signup via OAuth)
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      await connectDB();
      let existing = await User.findOne({ email: user.email!.toLowerCase() });
      if (!existing) {
        existing = await User.create({
          email: user.email!.toLowerCase(),
          name: user.name ?? user.email,
          accountType: "individual",
        });
      }
      if (existing.orgStatus === "banned") return "/login?error=account-banned";
      if (existing.orgStatus === "suspended") return "/login?error=account-suspended";
      user.id = existing._id.toString();
      return true;
    },
    async jwt({ token, user }) {
      await connectDB();
      if (user) {
        token.id = user.id;
        const dbUser = await User.findById(user.id);
        if (dbUser?.orgStatus !== "active") return null;
        token.accountType = dbUser?.accountType;
        token.signupStatus = dbUser?.signupStatus;
        token.orgId = dbUser?.orgId?.toString() ?? null;
      } else {
        // Re-checked on every request (not just at sign-in) so a suspension/ban takes effect
        // immediately for anyone already holding a session, not just on their next login.
        const current = await User.findById(token.id as string, "orgStatus");
        if (current && current.orgStatus !== "active") return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.accountType = token.accountType as "individual" | "organization";
        session.user.signupStatus = (token.signupStatus as "approved" | "pending" | "rejected") ?? "approved";
        session.user.orgId = (token.orgId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

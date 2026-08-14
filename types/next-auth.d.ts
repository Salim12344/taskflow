import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountType: "individual" | "organization";
      signupStatus: "approved" | "pending" | "rejected";
      orgId: string | null;
    } & DefaultSession["user"];
  }
}

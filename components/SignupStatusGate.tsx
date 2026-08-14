"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";

/** Blocks the app shell for a key-joiner whose org hasn't approved (or has declined) them yet. */
export function SignupStatusGate({ status }: { status: "pending" | "rejected" }) {
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    api<{ orgName: string | null }>("/api/me/org-status")
      .then((d) => setOrgName(d.orgName))
      .catch(() => {});
  }, []);

  const org = orgName ?? "the organization";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card elev-sm" style={{ width: "min(420px, 100%)", textAlign: "center" }}>
        {status === "pending" ? (
          <>
            <div className="card-title">Waiting on approval</div>
            <div className="card-body">
              Your request to join <strong>{org}</strong> is waiting on an admin. You&rsquo;ll be able to get in as soon as someone approves it.
            </div>
          </>
        ) : (
          <>
            <div className="card-title">Request declined</div>
            <div className="card-body">
              Your request to join <strong>{org}</strong> was declined. Contact an admin there if you think this is a mistake.
            </div>
          </>
        )}
        <button className="btn btn-secondary btn-block" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </div>
  );
}

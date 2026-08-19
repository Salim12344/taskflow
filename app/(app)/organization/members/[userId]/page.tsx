"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { onKeyActivate } from "@/lib/a11y";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Group = { _id: string; name: string; role: "admin" | "member" };
type OrgStatus = "active" | "suspended" | "banned";
type Member = {
  user: { _id: string; name: string; email: string; createdAt: string; orgStatus: OrgStatus; orgStatusReason: string | null; orgPermissions: string[] };
  groups: Group[];
  activeTaskCount: number;
  pendingApprovalCount: number;
  completedTaskCount: number;
};

const PERMISSIONS: { key: string; label: string; desc: string }[] = [
  { key: "view_all_tasks", label: "See all tasks in the org", desc: "Read access to every task across every group in the org, not just ones they admin." },
  { key: "org_override", label: "Org-owner-level override", desc: "Approve, reject, delete, or post in the chat of any task, org-wide — same emergency power you have. Doesn't extend to managing other admins." },
  { key: "approve_signups", label: "Approve new sign-ups", desc: "Can review and act on people requesting to join via the org's signup key." },
  { key: "create_groups", label: "Create groups", desc: "Can spin up their own new group under this org and admin it — the \"head of department\" role. Doesn't require them to already be in any group." },
];

export default function MemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = usePromise(params);
  const router = useRouter();
  const [data, setData] = useState<Member | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "ban" | "reinstate" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<Member>(`/api/organizations/mine/members/${userId}`)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e));
  }

  useEffect(load, [userId]);

  async function togglePermission(key: string) {
    if (!data) return;
    const current = data.user.orgPermissions;
    const next = current.includes(key) ? current.filter((p) => p !== key) : [...current, key];
    setData({ ...data, user: { ...data.user, orgPermissions: next } });
    try {
      await api(`/api/organizations/mine/members/${userId}`, { method: "PATCH", body: JSON.stringify({ orgPermissions: next }) });
    } catch (e) {
      setError(e);
      load();
    }
  }

  async function runAction() {
    if (!confirmAction || !data) return;
    setBusy(true);
    try {
      if (confirmAction === "remove") {
        await api(`/api/organizations/mine/members/${userId}`, { method: "DELETE" });
        router.push("/organization");
        return;
      }
      const orgStatus = confirmAction === "reinstate" ? "active" : confirmAction === "suspend" ? "suspended" : "banned";
      await api(`/api/organizations/mine/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ orgStatus }),
      });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setConfirmAction(null);
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="tf-fade page-pad" style={{ padding: "24px 40px" }}>
        <ErrorBanner error={error} onRetry={load} />
        {!error && "Loading…"}
      </div>
    );
  }

  const { user, groups, activeTaskCount, pendingApprovalCount, completedTaskCount } = data;
  const adminOfGroups = groups.filter((g) => g.role === "admin");
  const isAdminAnywhere = adminOfGroups.length > 0;

  function warningLines() {
    const lines: string[] = [];
    if (adminOfGroups.length > 0) lines.push(`Admin of ${adminOfGroups.length} group${adminOfGroups.length > 1 ? "s" : ""}: ${adminOfGroups.map((g) => g.name).join(", ")}.`);
    if (activeTaskCount > 0) lines.push(`Has ${activeTaskCount} active task(s) assigned — these will be unassigned and flagged for reassignment.`);
    if (pendingApprovalCount > 0) lines.push(`Is the delegated reviewer on ${pendingApprovalCount} task(s) pending approval — review will fall back to the task's creator.`);
    return lines;
  }

  const confirmCopy = {
    suspend: {
      title: "Suspend this account?",
      confirmLabel: "Suspend",
      description: [`${user.name} won't be able to log in at all until you reinstate them.`, ...warningLines()].join(" "),
    },
    ban: {
      title: "Ban this account?",
      confirmLabel: "Ban",
      description: [
        `${user.name} won't be able to log in, and their email won't be able to rejoin this org via the signup key again until you unban them.`,
        ...warningLines(),
      ].join(" "),
    },
    reinstate: {
      title: user.orgStatus === "banned" ? "Unban this account?" : "Unsuspend this account?",
      confirmLabel: user.orgStatus === "banned" ? "Unban" : "Unsuspend",
      description: `${user.name} will be able to log in again immediately${user.orgStatus === "banned" ? ", and their email can use the signup key again" : ""}.`,
    },
    remove: {
      title: "Remove from the organization?",
      confirmLabel: "Remove",
      description: [`${user.name} will be pulled out of every group in this org. Their account still exists — they just won't be part of this org anymore.`, ...warningLines()].join(" "),
    },
  }[confirmAction ?? "suspend"];

  return (
    <div className="tf-fade page-pad" style={{ padding: "24px 40px 40px", maxWidth: 800 }}>
      <div role="link" tabIndex={0} onClick={() => router.push("/organization")} onKeyDown={onKeyActivate(() => router.push("/organization"))} className="back-link" style={{ marginBottom: 14, width: "fit-content" }}>
        ← Organization
      </div>

      <ErrorBanner error={error} onRetry={load} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{user.name}</h2>
          <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>{user.email}</div>
        </div>
        {user.orgStatus !== "active" && (
          <span className="tag tag-danger">
            {user.orgStatus === "banned" ? "Banned" : "Suspended"}{user.orgStatusReason ? `: ${user.orgStatusReason}` : ""}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <div className="card elev-sm">
          <div className="card-title">Groups</div>
          {adminOfGroups.length > 0 && (
            <div className="card-body">Admin of {adminOfGroups.length} group{adminOfGroups.length > 1 ? "s" : ""}.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups.map((g) => (
              <div
                key={g._id}
                role="button"
                tabIndex={0}
                className="row-hover"
                onClick={() => router.push(`/groups/${g._id}`)}
                onKeyDown={onKeyActivate(() => router.push(`/groups/${g._id}`))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", borderRadius: 8, cursor: "pointer" }}
              >
                <span style={{ fontSize: 13.5 }}>{g.name}</span>
                <span className={g.role === "admin" ? "tag tag-accent" : "tag tag-neutral"}>{g.role}</span>
              </div>
            ))}
            {groups.length === 0 && <div className="card-meta">Not in any group yet.</div>}
          </div>
          <div className="card-meta" style={{ marginTop: 4 }}>
            {completedTaskCount} task(s) done.
          </div>
        </div>

        {isAdminAnywhere && (
          <div className="card elev-sm">
            <div className="card-title">Extra abilities</div>
            <div className="card-body">Org-wide extras, on top of whatever they already have per-group. Granted by you only.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {PERMISSIONS.map((p) => (
                <label key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-divider)", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{p.label}</div>
                    <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>{p.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.orgPermissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                    style={{ width: "auto", accentColor: "var(--color-accent)", flex: "none", marginTop: 3 }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="card elev-sm">
          <div className="card-title">Account actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {user.orgStatus === "active" && (
              <>
                <button className="btn btn-secondary" onClick={() => setConfirmAction("suspend")}>Suspend account</button>
                <button className="btn btn-secondary" style={{ color: "oklch(70% 0.15 25)" }} onClick={() => setConfirmAction("ban")}>Ban account</button>
              </>
            )}
            {user.orgStatus === "suspended" && (
              <>
                <button className="btn btn-secondary" onClick={() => setConfirmAction("reinstate")}>Unsuspend account</button>
                <button className="btn btn-secondary" style={{ color: "oklch(70% 0.15 25)" }} onClick={() => setConfirmAction("ban")}>Ban account</button>
              </>
            )}
            {user.orgStatus === "banned" && (
              <button className="btn btn-secondary" onClick={() => setConfirmAction("reinstate")}>Unban account</button>
            )}
            <button className="btn btn-secondary" style={{ color: "oklch(70% 0.15 25)" }} onClick={() => setConfirmAction("remove")}>
              Remove from organization
            </button>
          </div>
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={busy ? "Working…" : confirmCopy.confirmLabel}
          danger={confirmAction !== "reinstate"}
          onConfirm={runAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

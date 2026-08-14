"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { groupIcon } from "@/lib/group-icon";
import { onKeyActivate } from "@/lib/a11y";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Org = { _id: string; name: string; regNumber: string; groupCreators: { _id: string; name: string; email: string }[] };
type Group = { _id: string; name: string };

export default function OrganizationPage() {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [notOwner, setNotOwner] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ _id: string; name: string } | null>(null);

  function load() {
    api<{ organization: Org; groups: Group[] }>("/api/organizations/mine")
      .then((d) => { setOrg(d.organization); setGroups(d.groups); setError(null); })
      .catch((e) => {
        if (e.message.includes("don't own")) setNotOwner(true);
        else setError(e);
      });
  }

  useEffect(load, []);

  async function addCreator(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/organizations/mine/creators", { method: "POST", body: JSON.stringify({ email }) });
      setEmail("");
      load();
    } catch (e) {
      setError(e);
    }
  }

  async function removeCreator(userId: string) {
    setConfirmRemove(null);
    try {
      await api(`/api/organizations/mine/creators/${userId}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e);
    }
  }

  if (notOwner) {
    return (
      <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px" }}>
        <h2 style={{ marginBottom: 12 }}>Organization</h2>
        <div className="card-meta">You don&rsquo;t own an organization.</div>
      </div>
    );
  }

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px" }}>
      <h2 style={{ marginBottom: 4 }}>{org?.name ?? "…"}</h2>
      <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 22 }}>
        Registration #{org?.regNumber}
      </div>
      <ErrorBanner error={error} onRetry={load} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <div className="card elev-sm">
          <div className="card-title">Groups</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((g) => {
              const icon = groupIcon(g.name);
              return (
                <div key={g._id} role="button" tabIndex={0} className="row-hover" onClick={() => router.push(`/groups/${g._id}`)} onKeyDown={onKeyActivate(() => router.push(`/groups/${g._id}`))} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, cursor: "pointer" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: icon.bg, color: icon.fg, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {icon.letter}
                  </div>
                  <span style={{ fontSize: 13.5 }}>{g.name}</span>
                </div>
              );
            })}
            {groups.length === 0 && <div className="card-meta">No groups under this org yet.</div>}
          </div>
        </div>

        <div className="card elev-sm">
          <div className="card-title">Group creators</div>
          <div className="card-body">
            People with permission to create their own groups under this org and admin them — without owning the org itself. Good for department heads.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {org?.groupCreators.map((u) => (
              <div key={u._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div>
                  <div style={{ fontSize: 13.5 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{u.email}</div>
                </div>
                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "oklch(70% 0.15 25)" }} onClick={() => setConfirmRemove({ _id: u._id, name: u.name })}>
                  Remove
                </button>
              </div>
            ))}
            {org?.groupCreators.length === 0 && <div className="card-meta">Nobody granted yet.</div>}
          </div>
          <form onSubmit={addCreator} style={{ display: "flex", gap: 8 }}>
            <input className="input" type="email" required placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" type="submit">Grant</button>
          </form>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title="Revoke group-creator permission?"
          description={`${confirmRemove.name} will no longer be able to create groups under this org. Any groups they already created and admin stay untouched.`}
          confirmLabel="Revoke"
          danger
          onConfirm={() => removeCreator(confirmRemove._id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { resizeImageToDataUrl } from "@/lib/image";
import { Avatar } from "@/components/Avatar";

type Me = { name: string; email: string; accountType: string; avatarUrl: string | null; showOnlineStatus: boolean };

const PERSONAL_PREFS = [
  "Added to a group",
  "Task assigned or reassigned to you",
  "Task approved or rejected",
  "New @mention",
  "New direct message",
];

const ADMIN_ONLY_PREFS = [
  "Task submitted for review (you're an admin)",
];

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [isAdminAnywhere, setIsAdminAnywhere] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<boolean[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ user: Me; isAdminAnywhere: boolean }>("/api/me")
      .then((d) => {
        setMe(d.user);
        setName(d.user.name);
        setAvatarUrl(d.user.avatarUrl);
        setShowOnlineStatus(d.user.showOnlineStatus);
        setIsAdminAnywhere(d.isAdminAnywhere);
        const visiblePrefs = d.isAdminAnywhere ? [...PERSONAL_PREFS, ...ADMIN_ONLY_PREFS] : PERSONAL_PREFS;
        setPrefs(visiblePrefs.map(() => true));
      })
      .catch((e) => setError(e.message));
  }, []);

  const visiblePrefs = isAdminAnywhere ? [...PERSONAL_PREFS, ...ADMIN_ONLY_PREFS] : PERSONAL_PREFS;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/me", { method: "PATCH", body: JSON.stringify({ name, avatarUrl, showOnlineStatus }) });
      setSaved(true);
      window.dispatchEvent(new Event("taskflow:profile-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px" }}>
      <h2 style={{ marginBottom: 20 }}>Settings</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <div className="card elev-sm">
          <div className="card-title">Profile</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={name || "?"} avatarUrl={avatarUrl} size={72} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                Change photo
              </button>
              {avatarUrl && (
                <button type="button" className="btn btn-secondary" style={{ color: "var(--color-accent-300)" }} onClick={() => setAvatarUrl(null)}>
                  Remove photo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />
            </div>
          </div>

          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" value={me?.email ?? ""} readOnly />
          </div>
          <div className="field">
            <label>Account type</label>
            <input className="input" readOnly value={me?.accountType === "organization" ? "Organization" : "Individual"} />
          </div>

          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--color-divider)", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 13 }}>Show my online status</div>
              <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Lets others see when you're online or your last-seen time. Applies everywhere — DMs, group members, everyone.</div>
            </div>
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              style={{ width: "auto", accentColor: "var(--color-accent)", flex: "none" }}
            />
          </label>

          {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 12.5 }}>{error}</div>}
          {saved && <div style={{ color: "var(--color-accent-300)", fontSize: 12.5 }}>Saved.</div>}

          <button className="btn btn-primary" style={{ width: "fit-content" }} disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="card elev-sm">
          <div className="card-title">Email notifications</div>
          {visiblePrefs.map((label, i) => (
            <label key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-divider)", cursor: "pointer" }}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <input
                type="checkbox"
                checked={prefs[i] ?? true}
                onChange={() => setPrefs((p) => p.map((v, idx) => (idx === i ? !v : v)))}
                style={{ width: "auto", accentColor: "var(--color-accent)" }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

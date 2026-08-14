"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { ErrorBanner } from "@/components/ErrorBanner";

type Notif = {
  _id: string;
  type: string;
  text: string;
  description: string | null;
  read: boolean;
  createdAt: string;
  payload: Record<string, unknown>;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function destinationFor(n: Notif): string | null {
  if (n.payload.taskId) return `/tasks/${n.payload.taskId}`;
  if (n.payload.groupId) return `/groups/${n.payload.groupId}`;
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notif[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  function load() {
    api<{ notifications: Notif[] }>("/api/notifications")
      .then((d) => { setNotifications(d.notifications); setError(null); })
      .catch((e) => setError(e));
  }

  useEffect(load, []);

  async function markAllRead() {
    try {
      await api("/api/notifications/mark-all-read", { method: "POST" });
      window.dispatchEvent(new Event("taskflow:notifications-changed"));
      load();
    } catch (e) {
      setError(e);
    }
  }

  async function openNotification(n: Notif) {
    if (!n.read) {
      api(`/api/notifications/${n._id}`, { method: "PATCH", body: JSON.stringify({ read: true }) })
        .then(() => window.dispatchEvent(new Event("taskflow:notifications-changed")))
        .catch(() => {});
    }
    const dest = destinationFor(n);
    if (dest) router.push(dest);
  }

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px", maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>Notifications</h2>
        <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={markAllRead}>Mark all read</button>
      </div>
      <ErrorBanner error={error} onRetry={load} />
      {notifications?.length === 0 && <div className="card-meta">Nothing yet.</div>}
      <div className="card elev-sm" style={{ gap: 0 }}>
        {notifications?.map((n) => (
          <div
            key={n._id}
            className="row-hover"
            onClick={() => openNotification(n)}
            style={{ display: "flex", gap: 10, padding: "12px 4px", borderBottom: "1px solid var(--color-divider)", alignItems: "flex-start", cursor: "pointer" }}
          >
            <div style={{ width: 8, paddingTop: 6, flex: "none" }}>
              {!n.read && <span style={{ display: "block", width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.text}</div>
              {n.description && (
                <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 4, lineHeight: 1.4 }}>
                  {n.description}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 45%, transparent)", whiteSpace: "nowrap" }}>
              {timeAgo(n.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

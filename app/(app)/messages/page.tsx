"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";
import { isOnline, formatLastSeen } from "@/lib/presence";

type Thread = {
  threadId: string;
  other: { id: string; name: string; avatarUrl: string | null; lastActiveAt: string | null } | null;
  lastMessageAt: string;
  lastMessage: { text: string; senderId: string; createdAt: string } | null;
  unread: number;
};

export default function MessagesInboxPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      api<{ threads: Thread[] }>("/api/dm")
        .then((d) => setThreads(d.threads))
        .catch((e) => setError(e.message));
    }
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px" }}>
      <h2 style={{ marginBottom: 20 }}>Messages</h2>
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {threads?.length === 0 && <div className="card-meta">No conversations yet — message someone from a group&rsquo;s Members list.</div>}
      <div style={{ borderRadius: 8, overflow: "hidden", background: "var(--color-surface)" }}>
        {threads?.map((t) => {
          const mine = t.lastMessage?.senderId === session?.user?.id;
          return (
            <div
              key={t.threadId}
              className="row-hover"
              onClick={() => router.push(`/messages/${t.threadId}?from=inbox`)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--color-divider)" }}
            >
              <Avatar name={t.other?.name ?? "?"} avatarUrl={t.other?.avatarUrl} size={42} fontSize={13} online={isOnline(t.other?.lastActiveAt ?? null)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: t.unread > 0 ? 600 : 400 }}>{t.other?.name ?? "Unknown"}</div>
                <div style={{ fontSize: 13, color: t.unread > 0 ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 55%, transparent)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.lastMessage ? `${mine ? "You: " : ""}${t.lastMessage.text}` : "No messages yet"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
                  {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : ""}
                </div>
                {t.unread > 0 && (
                  <span style={{ background: "var(--color-accent)", color: "var(--color-bg)", fontSize: 10, fontWeight: 600, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                    {t.unread}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

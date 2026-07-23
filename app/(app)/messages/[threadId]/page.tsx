"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";

type Message = { _id: string; text: string; senderId: string; createdAt: string; readAt: string | null };
type Thread = { threadId: string; other: { id: string; name: string } | null };

export default function DmThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function loadMessages() {
    api<{ messages: Message[] }>(`/api/dm/${threadId}/messages`)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadMessages();
    api<{ threads: Thread[] }>("/api/dm")
      .then((d) => setOtherName(d.threads.find((t) => t.threadId === threadId)?.other?.name ?? null))
      .catch(() => {});
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!composer.trim()) return;
    const text = composer;
    setComposer("");
    try {
      await api(`/api/dm/${threadId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
      loadMessages();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const from = searchParams.get("from");
  const backTarget = from?.startsWith("group:") ? `/groups/${from.split(":")[1]}` : "/messages";
  const backLabel = from?.startsWith("group:") ? "Back to group" : "Messages";

  const initials = (otherName ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="tf-fade page-pad" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px 40px", minHeight: 0 }}>
      <div onClick={() => router.push(backTarget)} className="back-link" style={{ marginBottom: 14, width: "fit-content" }}>
        ← {backLabel}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>{otherName ?? "…"}</div>
          <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>Private conversation</div>
        </div>
      </div>
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div className="card-meta">No messages yet. Say hello.</div>}
        {messages.map((m, i) => {
          const mine = m.senderId === session?.user?.id;
          const isLastMine = mine && i === messages.length - 1;
          return (
            <div key={m._id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "55%", alignSelf: mine ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 3, padding: "0 2px" }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </div>
              <div style={{ padding: "9px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.4, background: mine ? "var(--color-accent)" : "var(--color-surface)", color: mine ? "var(--color-bg)" : "var(--color-text)" }}>
                {m.text}
              </div>
              {isLastMine && (
                <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 45%, transparent)", marginTop: 2, padding: "0 2px" }}>
                  {m.readAt ? "Seen" : "Delivered"}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input className="input" placeholder={`Message ${otherName ?? ""}…`} value={composer} onChange={(e) => setComposer(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary btn-icon" type="submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7L3 11z" /></svg>
        </button>
      </form>
    </div>
  );
}

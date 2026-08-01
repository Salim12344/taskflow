"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { api, uploadFile, type Attachment } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";
import { AttachmentView } from "@/components/AttachmentView";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { isOnline, formatLastSeen } from "@/lib/presence";

type ReplyTo = { messageId: string; text: string; senderName: string };
type Message = { _id: string; text: string; senderId: string; createdAt: string; readAt: string | null; replyTo: ReplyTo | null; attachments: Attachment[] };
type Thread = { threadId: string; other: { id: string; name: string; avatarUrl: string | null; lastActiveAt: string | null } | null };

export default function DmThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState<string | null>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherLastActive, setOtherLastActive] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ _id: string; text: string } | null>(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const voice = useVoiceRecorder();
  const endRef = useRef<HTMLDivElement>(null);
  const lastTypingPingRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadMessages() {
    api<{ messages: Message[]; otherTyping: boolean }>(`/api/dm/${threadId}/messages`)
      .then((d) => { setMessages(d.messages); setOtherTyping(d.otherTyping); })
      .catch((e) => setError(e.message));
  }

  function onComposerChange(value: string) {
    setComposer(value);
    const now = Date.now();
    if (now - lastTypingPingRef.current > 2500) {
      lastTypingPingRef.current = now;
      api(`/api/dm/${threadId}/typing`, { method: "POST" }).catch(() => {});
    }
  }

  function loadOther() {
    api<{ threads: Thread[] }>("/api/dm")
      .then((d) => {
        const other = d.threads.find((t) => t.threadId === threadId)?.other;
        setOtherName(other?.name ?? null);
        setOtherAvatar(other?.avatarUrl ?? null);
        setOtherLastActive(other?.lastActiveAt ?? null);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadMessages();
    loadOther();
    const interval = setInterval(() => { loadMessages(); loadOther(); }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function sendMessage() {
    if (!composer.trim()) return;
    const text = composer;
    setComposer("");
    const replyToId = replyingTo?._id;
    setReplyingTo(null);
    try {
      await api(`/api/dm/${threadId}/messages`, { method: "POST", body: JSON.stringify({ text, replyToId }) });
      loadMessages();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendAttachment(file: Blob, filename: string) {
    setSendingAttachment(true);
    const replyToId = replyingTo?._id;
    setReplyingTo(null);
    try {
      const attachment = await uploadFile(file, filename);
      await api(`/api/dm/${threadId}/messages`, { method: "POST", body: JSON.stringify({ text: "", attachments: [attachment], replyToId }) });
      loadMessages();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingAttachment(false);
    }
  }

  async function startVoicePress() {
    if (!voice.recording) await voice.start();
  }

  async function endVoicePress() {
    if (!voice.recording) return;
    const blob = await voice.stop();
    if (blob && blob.size > 0) await sendAttachment(blob, `voice-note.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) sendAttachment(file, file.name);
  }

  const from = searchParams.get("from");
  const backTarget = from?.startsWith("group:") ? `/groups/${from.split(":")[1]}` : "/messages";
  const backLabel = from?.startsWith("group:") ? "Back to group" : "Messages";

  return (
    <div className="tf-fade page-pad" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px 40px", minHeight: 0 }}>
      <div onClick={() => router.push(backTarget)} className="back-link" style={{ marginBottom: 14, width: "fit-content" }}>
        ← {backLabel}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Avatar name={otherName ?? "?"} avatarUrl={otherAvatar} size={32} fontSize={12} online={isOnline(otherLastActive)} />
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>{otherName ?? "…"}</div>
          <div style={{ fontSize: 11.5, color: isOnline(otherLastActive) ? "var(--color-green)" : "color-mix(in srgb, var(--color-text) 50%, transparent)", fontStyle: otherTyping ? "italic" : "normal" }}>
            {otherTyping ? "typing…" : formatLastSeen(otherLastActive)}
          </div>
        </div>
      </div>
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div className="card-meta">No messages yet. Say hello.</div>}
        {messages.map((m, i) => {
          const mine = m.senderId === session?.user?.id;
          const isLastMine = mine && i === messages.length - 1;
          return (
            <div key={m._id} className="row-hover" style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "55%", alignSelf: mine ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 3, padding: "0 2px" }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", flexDirection: mine ? "row-reverse" : "row" }}>
                <div style={{ padding: "9px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.4, background: mine ? "var(--color-accent)" : "var(--color-surface)", color: mine ? "var(--color-bg)" : "var(--color-text)" }}>
                  {m.replyTo && (
                    <div style={{ borderLeft: "2px solid currentColor", background: "color-mix(in srgb, currentColor 14%, transparent)", borderRadius: 6, padding: "4px 8px", marginBottom: 6, fontSize: 12.5 }}>
                      <div style={{ fontWeight: 600, opacity: 0.9 }}>{m.replyTo.senderName}</div>
                      <div style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{m.replyTo.text}</div>
                    </div>
                  )}
                  {m.attachments?.map((a, i) => <div key={i} style={{ marginBottom: m.text ? 6 : 0 }}><AttachmentView attachment={a} mine={mine} /></div>)}
                  {m.text}
                </div>
                <button
                  onClick={() => setReplyingTo({ _id: m._id, text: m.text || "📎 Attachment" })}
                  title="Reply"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.55, flex: "none" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17l-5-5 5-5M4 12h10a5 5 0 015 5v2" /></svg>
                </button>
              </div>
              {isLastMine && (
                <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 45%, transparent)", marginTop: 2, padding: "0 2px" }}>
                  {m.readAt ? `Seen ${new Date(m.readAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Delivered"}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {replyingTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginTop: 12, background: "var(--color-bg)", borderRadius: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9 17l-5-5 5-5M4 12h10a5 5 0 015 5v2" /></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-accent-300)" }}>{replyingTo._id && messages.find((m) => m._id === replyingTo._id)?.senderId === session?.user?.id ? "yourself" : otherName}</div>
            <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyingTo.text}</div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: 0.6, flex: "none" }}>×</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input ref={fileInputRef} type="file" onChange={onFilePicked} style={{ display: "none" }} />
        <button type="button" className="btn btn-secondary btn-icon" disabled={sendingAttachment || voice.recording} onClick={() => fileInputRef.current?.click()} title="Attach a file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
        </button>
        <input
          className="input"
          placeholder={voice.recording ? "Recording…" : `Message ${otherName ?? ""}…`}
          value={composer}
          disabled={voice.recording}
          onChange={(e) => onComposerChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {composer.trim() ? (
          <button className="btn btn-primary btn-icon" type="button" onClick={sendMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7L3 11z" /></svg>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-icon"
            disabled={sendingAttachment}
            onPointerDown={startVoicePress}
            onPointerUp={endVoicePress}
            onPointerLeave={endVoicePress}
            onPointerCancel={endVoicePress}
            title="Hold to record a voice note"
            style={{ background: voice.recording ? "oklch(60% 0.2 25)" : "var(--color-accent)", color: "var(--color-bg)", touchAction: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" /></svg>
          </button>
        )}
      </div>
      {voice.error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 12, marginTop: 4 }}>{voice.error}</div>}
    </div>
  );
}

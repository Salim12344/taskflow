"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

type TaskResult = { taskId: string; title: string; projectName: string; groupName: string };
type MessageResult = { messageId: string; groupId: string; groupName: string; text: string; senderName: string; createdAt: string };

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [messages, setMessages] = useState<MessageResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setTasks([]);
      setMessages([]);
      return;
    }
    const timeout = setTimeout(() => {
      api<{ tasks: TaskResult[]; messages: MessageResult[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => { setTasks(d.tasks); setMessages(d.messages); })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px", maxWidth: 800 }}>
      <h2 style={{ marginBottom: 16 }}>Search</h2>
      <input
        className="input"
        autoFocus
        placeholder="Search tasks and group chat…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 24 }}
      />
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {q.trim().length >= 2 && tasks.length === 0 && messages.length === 0 && (
        <div className="card-meta">No results for &ldquo;{q.trim()}&rdquo;.</div>
      )}

      {tasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 8 }}>Tasks</div>
          <div className="card elev-sm" style={{ gap: 0 }}>
            {tasks.map((t) => (
              <div
                key={t.taskId}
                onClick={() => router.push(`/tasks/${t.taskId}`)}
                className="row-hover"
                style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", margin: "0 -12px", borderRadius: 8, borderBottom: "1px solid var(--color-divider)" }}
              >
                <span style={{ fontSize: 13.5 }}>{t.title}</span>
                <span style={{ fontSize: 11.5, opacity: 0.6 }}>{t.groupName} · {t.projectName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 8 }}>Group chat</div>
          <div className="card elev-sm" style={{ gap: 0 }}>
            {messages.map((m) => (
              <div
                key={m.messageId}
                onClick={() => router.push(`/groups/${m.groupId}`)}
                className="row-hover"
                style={{ padding: "10px 12px", margin: "0 -12px", borderRadius: 8, borderBottom: "1px solid var(--color-divider)" }}
              >
                <div style={{ fontSize: 13.5 }}>{m.text}</div>
                <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 2 }}>{m.senderName} · {m.groupName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

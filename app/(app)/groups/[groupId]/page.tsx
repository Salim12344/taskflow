"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { groupIcon } from "@/lib/group-icon";

type Group = { _id: string; name: string };
type Project = { _id: string; name: string; description: string; status: string };
type Member = { _id: string; userId: { _id: string; name: string; email: string }; role: "admin" | "member" };
type GroupMessage = { _id: string; text: string; senderId: { _id: string; name: string } | string; createdAt: string; isSystemMessage?: boolean };

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = usePromise(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [tab, setTab] = useState<"projects" | "chat" | "members">("projects");
  const [group, setGroup] = useState<Group | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  function loadAll() {
    api<{ group: Group; showOnboarding: boolean }>(`/api/groups/${groupId}`)
      .then((d) => { setGroup(d.group); setShowOnboarding(d.showOnboarding); })
      .catch((e) => setError(e.message));
    api<{ projects: Project[] }>(`/api/groups/${groupId}/projects`)
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
    api<{ members: Member[] }>(`/api/groups/${groupId}/members`)
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message));
  }

  function loadMessages() {
    api<{ messages: GroupMessage[] }>(`/api/groups/${groupId}/messages`)
      .then((d) => setMessages(d.messages))
      .catch((e) => setError(e.message));
  }

  useEffect(loadAll, [groupId]);

  useEffect(() => {
    if (tab !== "chat") return;
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, groupId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const me = members?.find((m) => m.userId._id === session?.user?.id);
  const isAdmin = me?.role === "admin";

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/groups/${groupId}/projects`, { method: "POST", body: JSON.stringify({ name: projectName }) });
      setProjectName("");
      setShowNewProject(false);
      loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function dismissOnboarding() {
    await api(`/api/groups/${groupId}`, { method: "PATCH", body: JSON.stringify({ dismissOnboarding: true }) }).catch(() => {});
    setShowOnboarding(false);
  }

  async function setRole(userId: string, role: "admin" | "member") {
    try {
      await api(`/api/groups/${groupId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) });
      loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.userId.name} from the group?`)) return;
    try {
      await api(`/api/groups/${groupId}/members/${m.userId._id}`, { method: "DELETE" });
      loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function leaveGroup() {
    if (!confirm(`Leave ${group?.name}?`)) return;
    try {
      await api(`/api/groups/${groupId}/leave`, { method: "POST" });
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!composer.trim()) return;
    const text = composer;
    setComposer("");
    try {
      await api(`/api/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
      loadMessages();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function messageMember(userId: string) {
    try {
      const { threadId } = await api<{ threadId: string }>("/api/dm", {
        method: "POST",
        body: JSON.stringify({ otherUserId: userId }),
      });
      router.push(`/messages/${threadId}?from=group:${groupId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="tf-fade page-pad" style={{ padding: "24px 40px 0" }}>
        <div onClick={() => router.push("/dashboard")} className="back-link" style={{ marginBottom: 14 }}>
          ← Dashboard
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {group && (
              <div style={{ width: 30, height: 30, borderRadius: 8, background: groupIcon(group.name).bg, color: groupIcon(group.name).fg, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {groupIcon(group.name).letter}
              </div>
            )}
            <h2>{group?.name ?? "…"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isAdmin && <button className="btn btn-primary" onClick={() => router.push(`/groups/${groupId}/invite`)}>Invite people</button>}
            <button className="btn btn-secondary" onClick={leaveGroup}>Leave group</button>
          </div>
        </div>
        {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, margin: "8px 0" }}>{error}</div>}

        {showOnboarding && (
          <div className="card elev-sm" style={{ margin: "12px 0" }}>
            <div className="card-title">Get your group going</div>
            <div className="card-body">Create your first project → Invite your team → Assign a task.</div>
            <button className="btn btn-secondary" style={{ width: "fit-content" }} onClick={dismissOnboarding}>Dismiss</button>
          </div>
        )}

        <div style={{ display: "inline-flex", border: "1px solid var(--color-divider)", borderRadius: 8, overflow: "hidden", margin: "22px 0" }}>
          <div onClick={() => setTab("projects")} className={`tab-btn ${tab === "projects" ? "tab-active" : ""}`} style={{ background: tab === "projects" ? "var(--color-accent)" : "transparent", color: tab === "projects" ? "var(--color-bg)" : "inherit" }}>Projects</div>
          <div onClick={() => setTab("chat")} className={`tab-btn ${tab === "chat" ? "tab-active" : ""}`} style={{ borderLeft: "1px solid var(--color-divider)", background: tab === "chat" ? "var(--color-accent)" : "transparent", color: tab === "chat" ? "var(--color-bg)" : "inherit" }}>Chat</div>
          <div onClick={() => setTab("members")} className={`tab-btn ${tab === "members" ? "tab-active" : ""}`} style={{ borderLeft: "1px solid var(--color-divider)", background: tab === "members" ? "var(--color-accent)" : "transparent", color: tab === "members" ? "var(--color-bg)" : "inherit" }}>Members</div>
        </div>
      </div>

      {tab === "projects" && (
        <div className="page-pad" style={{ padding: "0 40px 40px" }}>
          {isAdmin && (
            <div style={{ marginBottom: 16 }}>
              {!showNewProject ? (
                <button className="btn btn-secondary" onClick={() => setShowNewProject(true)}>New project</button>
              ) : (
                <form onSubmit={createProject} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                  <input className="input" placeholder="Project name" required value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                  <button className="btn btn-primary" type="submit">Create</button>
                </form>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
            {projects?.map((p) => (
              <div key={p._id} className="card elev-sm card-clickable" onClick={() => router.push(`/projects/${p._id}`)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div className="card-title">{p.name}</div>
                  <span className="tag tag-accent">{p.status}</span>
                </div>
                <div className="card-body">{p.description}</div>
              </div>
            ))}
            {projects?.length === 0 && <div className="card-meta">No projects yet.</div>}
          </div>
        </div>
      )}

      {tab === "chat" && (
        <div className="page-pad" style={{ padding: "0 40px 40px", display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 360 }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "6px 0" }}>
            {messages.length === 0 && <div className="card-meta">No messages yet. Say hello.</div>}
            {messages.map((m) => {
              const senderId = typeof m.senderId === "string" ? m.senderId : m.senderId._id;
              const senderName = typeof m.senderId === "string" ? "" : m.senderId.name;
              const mine = senderId === session?.user?.id;
              if (m.isSystemMessage) {
                return (
                  <div key={m._id} style={{ textAlign: "center", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
                    {m.text}
                  </div>
                );
              }
              return (
                <div key={m._id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "58%", alignSelf: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 3, padding: "0 2px" }}>
                    {senderName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                  <div style={{ padding: "9px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.4, background: mine ? "var(--color-accent)" : "var(--color-surface)", color: mine ? "var(--color-bg)" : "var(--color-text)" }}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input className="input" placeholder={`Message ${group?.name ?? "group"}…`} value={composer} onChange={(e) => setComposer(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-icon" type="submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7L3 11z" /></svg>
            </button>
          </form>
        </div>
      )}

      {tab === "members" && (
        <div className="page-pad" style={{ padding: "0 40px 40px" }}>
          <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {members?.map((m) => {
                const isMe = m.userId._id === session?.user?.id;
                return (
                  <tr key={m._id} className="row-hover" style={{ cursor: "default" }}>
                    <td>
                      <div>{m.userId.name}</div>
                      <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{m.userId.email}</div>
                    </td>
                    <td><span className={m.role === "admin" ? "tag tag-accent" : "tag tag-neutral"}>{m.role}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {isAdmin && !isMe && (
                          <>
                            <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setRole(m.userId._id, m.role === "admin" ? "member" : "admin")}>
                              {m.role === "admin" ? "Demote" : "Promote"}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--color-accent-300)" }} onClick={() => removeMember(m)}>
                              Remove
                            </button>
                          </>
                        )}
                        {!isMe && (
                          <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => messageMember(m.userId._id)}>
                            Message
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {!isAdmin && <div style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginTop: 12 }}>Only admins can manage members.</div>}
        </div>
      )}
    </div>
  );
}

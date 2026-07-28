"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";

type Task = {
  _id: string;
  title: string;
  description: string;
  status: string;
  assignedTo: string | null;
  createdBy: string;
  projectId: string;
  deadline: string | null;
  subtasks: { text: string; done: boolean }[];
  rejectionHistory: { reviewerId: string; reason: string; createdAt: string }[];
  reviewerId: string | null;
  pendingReviewDelegation: { toUserId: string; fromUserId: string; createdAt: string } | null;
};
type Project = { _id: string; name: string; groupId: string };
type Member = { userId: { _id: string; name: string; avatarUrl: string | null }; role: "admin" | "member" };
type ChatMessage = { _id: string; text: string; senderId: string; createdAt: string };

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  pending_review: "Pending review",
  done: "Done",
};

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = usePromise(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatCanWrite, setChatCanWrite] = useState(false);
  const [composer, setComposer] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  function load() {
    api<{ task: Task }>(`/api/tasks/${taskId}`)
      .then((d) => {
        setTask(d.task);
        return api<{ project: Project }>(`/api/projects/${d.task.projectId}`);
      })
      .then((d) => {
        setProject(d.project);
        return api<{ members: Member[] }>(`/api/groups/${d.project.groupId}/members`);
      })
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message));
  }

  useEffect(load, [taskId]);

  function loadChat() {
    api<{ messages: ChatMessage[]; canWrite: boolean }>(`/api/tasks/${taskId}/chat`)
      .then((d) => { setChatMessages(d.messages); setChatCanWrite(d.canWrite); })
      .catch(() => {});
  }

  useEffect(() => {
    loadChat();
    const interval = setInterval(loadChat, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages]);

  const userId = session?.user?.id;
  const isAssignee = task?.assignedTo === userId;
  // Approximates server enforcement for showing/hiding buttons; server is the source of truth.
  // An org owner may not have an explicit GroupMember row, so accountType fills that gap here.
  const isOrgAccount = session?.user?.accountType === "organization";
  const isAdmin = isOrgAccount || members.some((m) => m.userId._id === userId && m.role === "admin");
  const isCreator = task?.createdBy === userId;
  const nameFor = (id: string | null) => (id ? members.find((m) => m.userId._id === id)?.userId.name ?? "—" : "Unassigned");
  const otherAdmins = members.filter((m) => m.role === "admin" && m.userId._id !== userId);

  // Default manager is whoever created/assigned the task, not "any admin" — that's the whole
  // point of delegation existing. Once delegated, control fully moves to that admin (plus the
  // org owner, who always keeps an emergency fallback to act on the task).
  const isDesignatedManager = !!task?.reviewerId && task.reviewerId === userId;
  const canManage = task?.reviewerId ? isDesignatedManager || isOrgAccount : isCreator || isOrgAccount;
  // Once approved, a task is a closed record — nobody can delete it, manager or not.
  const canDelete = canManage && task?.status !== "done";
  // Handing a task off reassigns who's accountable for it — narrower than canManage, so even
  // the org owner's emergency override doesn't extend to it, only the creator/current delegate.
  const canDelegate = isDesignatedManager || (!task?.reviewerId && isCreator);
  const delegation = task?.pendingReviewDelegation ?? null;
  const isDelegationTarget = !!delegation && delegation.toUserId === userId;

  async function moveStatus(status: string, reason?: string) {
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
      setShowReject(false);
      setRejectReason("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleSubtask(index: number, done: boolean) {
    try {
      await api(`/api/tasks/${taskId}/subtasks`, { method: "PATCH", body: JSON.stringify({ index, done }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteTask() {
    if (!confirm("Delete this task?")) return;
    try {
      await api(`/api/tasks/${taskId}`, { method: "DELETE" });
      router.push(`/projects/${task?.projectId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendDelegate() {
    if (!delegateTarget) return;
    try {
      await api(`/api/tasks/${taskId}/delegate-review`, { method: "POST", body: JSON.stringify({ toUserId: delegateTarget }) });
      setDelegateTarget("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelDelegate() {
    try {
      await api(`/api/tasks/${taskId}/delegate-review`, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function respondToDelegate(accept: boolean) {
    try {
      await api(`/api/tasks/${taskId}/delegate-review/respond`, { method: "POST", body: JSON.stringify({ accept }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!composer.trim()) return;
    const text = composer;
    setComposer("");
    try {
      await api(`/api/tasks/${taskId}/chat`, { method: "POST", body: JSON.stringify({ text }) });
      loadChat();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!task) {
    return <div className="tf-fade page-pad" style={{ padding: "24px 40px" }}>{error ?? "Loading…"}</div>;
  }

  return (
    <div className="tf-fade page-pad" style={{ padding: "24px 40px 40px" }}>
      <div onClick={() => router.push(`/projects/${task.projectId}`)} className="back-link" style={{ marginBottom: 14 }}>
        ← {project?.name ?? "Back"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <h3>{task.title}</h3>
        <span className="tag tag-neutral">{STATUS_LABEL[task.status]}</span>
      </div>
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="detail-grid-2col" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card elev-sm">
          <div className="card-title" style={{ fontSize: 14 }}>Description</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, opacity: 0.85 }}>{task.description || "No description."}</div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 4 }}>Assignee</div>
            <div style={{ fontSize: 14 }}>{nameFor(task.assignedTo)}</div>
          </div>
          {task.deadline && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 4 }}>Due date</div>
              <div style={{ fontSize: 14 }}>{new Date(task.deadline).toLocaleDateString()}</div>
            </div>
          )}

          {task.status !== "done" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 4 }}>Managed by</div>

              {delegation ? (
                isDelegationTarget ? (
                  <div>
                    <div style={{ fontSize: 13.5, marginBottom: 6 }}>
                      {nameFor(delegation.fromUserId)} wants to hand off this task to you — you&rsquo;d edit, reassign, delete, and approve/reject it going forward.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => respondToDelegate(true)}>Accept</button>
                      <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => respondToDelegate(false)}>Decline</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5 }}>
                    Hand-off pending — waiting on {nameFor(delegation.toUserId)} to accept.
                    {delegation.fromUserId === userId && (
                      <button className="btn btn-secondary" style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12 }} onClick={cancelDelegate}>Cancel</button>
                    )}
                  </div>
                )
              ) : (
                <div style={{ fontSize: 14 }}>{nameFor(task.reviewerId ?? task.createdBy)}</div>
              )}

              {canDelegate && !delegation && otherAdmins.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <select className="input" value={delegateTarget} onChange={(e) => setDelegateTarget(e.target.value)}>
                    <option value="">{task.reviewerId ? "Hand off to…" : "Hand off to…"}</option>
                    {otherAdmins.map((m) => <option key={m.userId._id} value={m.userId._id}>{m.userId.name}</option>)}
                  </select>
                  <button className="btn btn-secondary" onClick={sendDelegate}>Send</button>
                </div>
              )}
            </div>
          )}

          {task.subtasks.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 6 }}>
                Subtasks ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {task.subtasks.map((s, i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                    <input type="checkbox" checked={s.done} onChange={(e) => toggleSubtask(i, e.target.checked)} disabled={!isAssignee && !isAdmin} />
                    <span style={{ textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.6 : 1 }}>{s.text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {task.rejectionHistory.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 6 }}>Rejection history</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {task.rejectionHistory.map((r, i) => (
                  <div key={i} className="card-body" style={{ background: "var(--color-bg)", padding: 8, borderRadius: 8 }}>
                    {r.reason} <span style={{ opacity: 0.6 }}>— {new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {isAssignee && task.status === "todo" && <button className="btn btn-primary" onClick={() => moveStatus("in_progress")}>Start task</button>}
            {isAssignee && task.status === "in_progress" && <button className="btn btn-primary" onClick={() => moveStatus("pending_review")}>Submit for review</button>}
            {canManage && task.status === "pending_review" && (
              <>
                <button className="btn btn-primary" onClick={() => moveStatus("done")}>Approve</button>
                <button className="btn btn-secondary" style={{ color: "var(--color-accent-300)" }} onClick={() => setShowReject((s) => !s)}>Reject</button>
              </>
            )}
            {canDelete && <button className="btn btn-secondary" style={{ color: "var(--color-accent-300)" }} onClick={deleteTask}>Delete task</button>}
          </div>

          {showReject && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input className="input" placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <button className="btn btn-primary" onClick={() => rejectReason && moveStatus("in_progress", rejectReason)}>Send</button>
            </div>
          )}
        </div>

        <div className="card elev-sm" style={{ height: 480 }}>
          <div className="card-title">Task chat</div>
          {!chatCanWrite && (
            <div className="card-body">You can view this thread, but only the assignee and the task&rsquo;s manager can post here.</div>
          )}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {chatMessages.length === 0 && <div className="card-meta">No messages yet.</div>}
            {chatMessages.map((m) => {
              const mine = m.senderId === userId;
              const sender = members.find((mem) => mem.userId._id === m.senderId);
              return (
                <div key={m._id} style={{ display: "flex", gap: 8, alignSelf: mine ? "flex-end" : "flex-start", flexDirection: mine ? "row-reverse" : "row", maxWidth: "80%" }}>
                  {!mine && <Avatar name={sender?.userId.name ?? "?"} avatarUrl={sender?.userId.avatarUrl} size={24} />}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 3, padding: "0 2px" }}>
                      {sender?.userId.name ?? "—"} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.4, background: mine ? "var(--color-accent)" : "var(--color-bg)", color: mine ? "var(--color-bg)" : "var(--color-text)" }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          {chatCanWrite && (
            <form onSubmit={sendChatMessage} style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Message…" value={composer} onChange={(e) => setComposer(e.target.value)} />
              <button className="btn btn-primary btn-icon" type="submit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7L3 11z" /></svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { statusColorVar } from "@/lib/status";

type Project = { _id: string; name: string; description: string; groupId: string };
type Task = { _id: string; title: string; status: string; assignedTo: string | null; deadline: string | null };
type Member = { userId: { _id: string; name: string }; role: "admin" | "member" };

const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "pending_review", label: "Pending review" },
  { key: "done", label: "Done" },
];

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = usePromise(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState("todo");

  function load() {
    api<{ project: Project }>(`/api/projects/${projectId}`)
      .then((d) => {
        setProject(d.project);
        return api<{ members: Member[] }>(`/api/groups/${d.project.groupId}/members`);
      })
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message));
    api<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks`)
      .then((d) => setTasks(d.tasks))
      .catch((e) => setError(e.message));
  }

  useEffect(load, [projectId]);

  const isAdmin = members?.some((m) => m.userId._id === session?.user?.id && m.role === "admin");
  const nameFor = (userId: string | null) => (userId ? members?.find((m) => m.userId._id === userId)?.userId.name ?? "—" : "Unassigned");

  return (
    <div className="tf-fade page-pad" style={{ padding: "24px 40px 40px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div onClick={() => project && router.push(`/groups/${project.groupId}`)} className="back-link" style={{ marginBottom: 14, width: "fit-content" }}>
        ← Back to group
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2>{project?.name ?? "…"}</h2>
        {isAdmin && <button className="btn btn-primary" onClick={() => router.push(`/projects/${projectId}/new-task`)}>New task</button>}
      </div>
      <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 16 }}>{project?.description}</div>
      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, flex: 1, minHeight: 0 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks?.filter((t) => t.status === col.key) ?? [];
          return (
            <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8 }}>
                  <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>{col.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: statusColorVar(col.key) }}>[{String(colTasks.length).padStart(2, "0")}]</span>
                </div>
                <div style={{ height: 2, background: statusColorVar(col.key), opacity: colTasks.length ? 0.7 : 0.2, borderRadius: 1 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingTop: 2 }}>
                {colTasks.map((t) => (
                  <div key={t._id} className="card elev-sm kanban-card status-rail" style={{ "--rail-color": statusColorVar(t.status) } as React.CSSProperties} onClick={() => router.push(`/tasks/${t._id}`)}>
                    <div className="card-title" style={{ fontSize: 14.5 }}>{t.title}</div>
                    <div className="card-meta">{nameFor(t.assignedTo)}</div>
                    {t.deadline && <div className="card-meta"><span className="tag tag-outline">Due <span className="mono">{new Date(t.deadline).toLocaleDateString()}</span></span></div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: a status dropdown instead of a side-scrolling board — nobody wants to swipe sideways on a phone. */}
      <div className="kanban-mobile-filter" style={{ flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <select className="input" style={{ width: "auto" }} value={mobileStatus} onChange={(e) => setMobileStatus(e.target.value)}>
          {COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>{col.label} · {tasks?.filter((t) => t.status === col.key).length ?? 0}</option>
          ))}
        </select>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {(tasks?.filter((t) => t.status === mobileStatus) ?? []).map((t) => (
            <div key={t._id} className="card elev-sm kanban-card status-rail" style={{ "--rail-color": statusColorVar(t.status) } as React.CSSProperties} onClick={() => router.push(`/tasks/${t._id}`)}>
              <div className="card-title" style={{ fontSize: 14.5 }}>{t.title}</div>
              <div className="card-meta">{nameFor(t.assignedTo)}</div>
              {t.deadline && <div className="card-meta"><span className="tag tag-outline">Due <span className="mono">{new Date(t.deadline).toLocaleDateString()}</span></span></div>}
            </div>
          ))}
          {tasks && tasks.filter((t) => t.status === mobileStatus).length === 0 && (
            <div className="card-meta">Nothing here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

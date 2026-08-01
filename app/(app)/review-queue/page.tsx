"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { statusColorVar } from "@/lib/status";

type Section = {
  groupId: string;
  groupName: string;
  tasks: { taskId: string; title: string; projectName: string; submittedAt: string | null }[];
};

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending review" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export default function ReviewQueuePage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending_review");
  const [byStatus, setByStatus] = useState<Record<string, Section[]>>({});
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      STATUS_OPTIONS.map((o) =>
        api<{ sections: Section[]; mine: boolean }>(`/api/review-queue?status=${o.value}`).then((d) => [o.value, d] as const)
      )
    )
      .then((entries) => {
        setByStatus(Object.fromEntries(entries.map(([k, d]) => [k, d.sections])));
        setMine(entries[0]?.[1].mine ?? false);
      })
      .catch((e) => setError(e.message));
  }, []);

  const countFor = (s: string) => (byStatus[s] ?? []).reduce((sum, sec) => sum + sec.tasks.length, 0);
  const sections = byStatus[status];

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px", maxWidth: 1200 }}>
      <h2 style={{ marginBottom: 16 }}>{mine ? "My tasks" : "Tasks"}</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {STATUS_OPTIONS.map((o) => {
          const active = status === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setStatus(o.value)}
              className="tab-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "1px solid var(--color-divider)",
                borderRadius: 8,
                background: active ? "color-mix(in srgb, var(--color-accent) 16%, transparent)" : "transparent",
                borderColor: active ? "var(--color-accent)" : "var(--color-divider)",
                color: active ? "var(--color-accent-300)" : "inherit",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColorVar(o.value), flex: "none" }} />
              {o.label}
              <span className="mono" style={{ fontSize: 11, opacity: active ? 1 : 0.55 }}>{countFor(o.value)}</span>
            </button>
          );
        })}
      </div>

      {error && <div style={{ color: "oklch(70% 0.15 25)", fontSize: 13 }}>{error}</div>}
      {sections?.length === 0 && <div className="card-meta">Nothing here.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {sections?.map((s) => (
          <div key={s.groupId}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.groupName}</span>
              <span className="mono" style={{ fontSize: 11, color: statusColorVar(status) }}>[{String(s.tasks.length).padStart(2, "0")}]</span>
            </div>
            <div className="card elev-sm" style={{ gap: 0 }}>
              {s.tasks.map((t) => (
                <div
                  key={t.taskId}
                  onClick={() => router.push(`/tasks/${t.taskId}`)}
                  className="row-hover"
                  style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", margin: "0 -12px", borderRadius: 8, borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span style={{ fontSize: 13.5 }}>{t.title} <span style={{ opacity: 0.6 }}>· {t.projectName}</span></span>
                  <span className="mono" style={{ fontSize: 11.5, opacity: 0.6 }}>{t.submittedAt ? new Date(t.submittedAt).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

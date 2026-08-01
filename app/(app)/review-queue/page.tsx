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
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSections(null);
    api<{ sections: Section[] }>(`/api/review-queue?status=${status}`)
      .then((d) => setSections(d.sections))
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <div className="tf-fade page-pad" style={{ padding: "32px 40px 40px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2>Tasks — {STATUS_OPTIONS.find((o) => o.value === status)?.label}</h2>
        <select className="input" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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

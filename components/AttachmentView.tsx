import type { Attachment } from "@/lib/api-client";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentView({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  if (attachment.type.startsWith("audio/")) {
    return (
      <audio
        controls
        src={attachment.url}
        style={{ height: 34, maxWidth: 220, filter: mine ? "invert(1) grayscale(1) contrast(0.9)" : undefined }}
      />
    );
  }

  if (attachment.type.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img src={attachment.url} alt={attachment.name} style={{ display: "block", maxWidth: 220, maxHeight: 220, borderRadius: 8, objectFit: "cover" }} />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.12)", color: "inherit", textDecoration: "none", maxWidth: 220 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</div>
        <div style={{ fontSize: 10.5, opacity: 0.7 }}>{formatSize(attachment.size)}</div>
      </div>
    </a>
  );
}

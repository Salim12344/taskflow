import { ApiError } from "@/lib/api-client";

/** Retry only makes sense for transient failures (network drop, server hiccup) — a permission
 * or validation error will just fail the same way again, so no retry button for those. */
export function ErrorBanner({ error, onRetry, style }: { error: unknown; onRetry?: () => void; style?: React.CSSProperties }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const kind = error instanceof ApiError ? error.kind : "unknown";
  const canRetry = !!onRetry && kind !== "permission" && kind !== "validation";

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "color-mix(in srgb, oklch(60% 0.18 25) 12%, transparent)",
        border: "1px solid color-mix(in srgb, oklch(60% 0.18 25) 35%, transparent)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
        color: "oklch(78% 0.14 25)",
        marginBottom: 16,
        ...style,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {canRetry && (
        <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, flex: "none" }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

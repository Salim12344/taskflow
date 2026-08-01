"use client";

import { useEffect, useRef } from "react";

/** In-app replacement for window.confirm() — states the actual consequence, keyboard-operable (Escape to cancel, focus lands on the safe default). */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      role="presentation"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="card elev-sm"
        style={{ width: 360, maxWidth: "100%" }}
      >
        <div id="confirm-dialog-title" className="card-title">{title}</div>
        <div id="confirm-dialog-desc" className="card-body">{description}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button ref={cancelRef} className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={danger ? { background: "oklch(60% 0.18 25)", boxShadow: "none" } : undefined} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

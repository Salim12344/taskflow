export const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  pending_review: "Pending review",
  done: "Done",
};

/** CSS var name for this status's rail/accent color — see :root in globals.css. */
export function statusColorVar(status: string) {
  return `var(--status-${status}, var(--color-divider))`;
}

/** CSS var name for this status's pre-mixed background wash — see :root in globals.css. */
export function statusBgVar(status: string) {
  return `var(--status-${status}-bg, var(--color-surface))`;
}

/** A deadline only reads as "overdue" if the task isn't already done — a finished task's stale due date is just history. */
export function isOverdue(deadline: string | null, status: string) {
  return !!deadline && status !== "done" && new Date(deadline) < new Date();
}

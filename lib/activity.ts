import ActivityLog from "@/models/ActivityLog";

/** text is denormalized at write time (same pattern as Notification) so the log never needs joins to render. */
export function logActivity(
  groupId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  text: string
) {
  return ActivityLog.create({ groupId, actorId, action, targetType, targetId, meta: { text } });
}

import Notification from "@/models/Notification";

export function notify(
  userId: string,
  type: string,
  text: string,
  opts?: { description?: string; payload?: Record<string, unknown> }
) {
  return Notification.create({
    userId,
    type,
    text,
    description: opts?.description ?? null,
    payload: opts?.payload ?? {},
  });
}

export function notifyMany(
  userIds: string[],
  type: string,
  text: string,
  opts?: { description?: string; payload?: Record<string, unknown> }
) {
  if (userIds.length === 0) return Promise.resolve();
  return Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      type,
      text,
      description: opts?.description ?? null,
      payload: opts?.payload ?? {},
    }))
  );
}

import TypingIndicator from "@/models/TypingIndicator";

const TYPING_WINDOW_MS = 6000;

export async function pingTyping(scopeType: "group" | "dm", scopeId: string, userId: string) {
  await TypingIndicator.updateOne(
    { scopeType, scopeId, userId },
    { $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getTypingUsers(scopeType: "group" | "dm", scopeId: string, excludeUserId: string) {
  const since = new Date(Date.now() - TYPING_WINDOW_MS);
  const rows = await TypingIndicator.find({ scopeType, scopeId, userId: { $ne: excludeUserId }, updatedAt: { $gte: since } }).populate(
    "userId",
    "name"
  );
  return rows.map((r) => r.userId as unknown as { _id: string; name: string });
}

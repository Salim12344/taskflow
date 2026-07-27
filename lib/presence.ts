const ONLINE_WINDOW_MS = 90_000; // heartbeat pings every 30s, so 90s of silence means offline

export function isOnline(lastActiveAt: string | Date | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS;
}

export function formatLastSeen(lastActiveAt: string | Date | null) {
  if (!lastActiveAt) return "Offline";
  if (isOnline(lastActiveAt)) return "Online";
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
}

/** Strips presence info server-side when the user has opted out — never trust the client to hide it. */
export function maskPresence<T extends { lastActiveAt: Date | null; showOnlineStatus: boolean }>(user: T) {
  return user.showOnlineStatus ? user.lastActiveAt : null;
}

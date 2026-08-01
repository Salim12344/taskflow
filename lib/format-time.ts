const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** WhatsApp-style: time if today, "Yesterday" if yesterday, weekday name within the last week, else a short date. */
export function formatChatListTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (dayDiff === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAYS[date.getDay()];
  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

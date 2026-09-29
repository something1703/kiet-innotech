/** Formats a number in the Indian digit grouping, e.g. 238000 -> "2,38,000". */
export function formatINR(amount: number) {
  return amount.toLocaleString("en-IN");
}

/** Formats an ISO timestamp in Indian time, e.g. "3 Oct 2026, 10:00 am". */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Formats an ISO timestamp as a date only, e.g. "3 Oct 2026". */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

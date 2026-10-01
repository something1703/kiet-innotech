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

/** The account's display name, or "" when it is just the email's local part (what sign-in falls back to without a name). */
export function accountName(name: string, email: string) {
  const trimmed = name.trim();
  return trimmed.toLowerCase() === email.split("@")[0].toLowerCase() ? "" : trimmed;
}

const IST = "Asia/Kolkata";

/** e.g. "12 October 2026", in IST. */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "long", year: "numeric" });
}

/** e.g. "12 October", in IST. */
export function dayMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "long" });
}

/** e.g. "12 October 2026, 11:59 PM IST". */
export function longDateTime(iso: string) {
  const time = new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return `${longDate(iso)}, ${time} IST`;
}

/** "2026-10-12", the IST calendar day of a moment. */
export function istDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
}

/** A range of two moments as short dates: "3 - 12 Oct 2026", "28 Sep - 12 Oct 2026", "30 Dec 2026 - 3 Jan 2027". */
export function dateRange(fromIso: string, toIso: string) {
  const parts = (iso: string) => {
    const [year, month, day] = istDay(iso).split("-").map(Number);
    const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { timeZone: "UTC", month: "short" });
    return { year, month, day, monthName };
  };
  const a = parts(fromIso);
  const b = parts(toIso);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return `${b.day} ${b.monthName} ${b.year}`;
  if (a.year === b.year && a.month === b.month) return `${a.day} - ${b.day} ${b.monthName} ${b.year}`;
  if (a.year === b.year) return `${a.day} ${a.monthName} - ${b.day} ${b.monthName} ${b.year}`;
  return `${a.day} ${a.monthName} ${a.year} - ${b.day} ${b.monthName} ${b.year}`;
}

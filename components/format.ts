import type { AnswerValue } from "@/lib/types";

// SQLite datetime('now') is UTC without a zone marker; tag it before parsing.
function parseUTC(sqlite: string): Date {
  return new Date(sqlite.replace(" ", "T") + "Z");
}

/** "Jul 18" */
export function fmtDate(sqlite: string): string {
  return parseUTC(sqlite).toLocaleString("en-US", { month: "short", day: "numeric" });
}

/** "Jul 18, 3:42 PM" */
export function fmtWhen(sqlite: string): string {
  return parseUTC(sqlite).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Display value for a response cell: arrays joined, blanks as an em dash. */
export function valStr(v: AnswerValue | undefined): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

import type { AnswerValue } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// SQLite datetime('now') is UTC without a zone marker; tag it before parsing.
function parseUTC(sqlite: string): Date {
  return new Date(sqlite.replace(" ", "T") + "Z");
}

/** "Jul 18" */
export function fmtDate(sqlite: string): string {
  const d = parseUTC(sqlite);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Jul 18, 3:42 PM" */
export function fmtWhen(sqlite: string): string {
  const d = parseUTC(sqlite);
  const h = d.getHours();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Display value for a response cell: arrays joined, blanks as an em dash. */
export function valStr(v: AnswerValue | undefined): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

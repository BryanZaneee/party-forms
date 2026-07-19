import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Answers, Form, Question, Submission } from "./types.ts";

const db = new Database(path.join(process.cwd(), "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    questions TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id),
    answers TEXT NOT NULL,
    via TEXT NOT NULL DEFAULT 'form',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Guarded migrations for databases created before these columns existed.
const hasColumn = (table: string, column: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
if (!hasColumn("forms", "description")) db.exec("ALTER TABLE forms ADD COLUMN description TEXT NOT NULL DEFAULT ''");
if (!hasColumn("submissions", "via")) db.exec("ALTER TABLE submissions ADD COLUMN via TEXT NOT NULL DEFAULT 'form'");

// Seed doubles as demo data and AI-test fixture (docs/prd.md, Fixtures & testing).
const SEED_QUESTIONS: Question[] = [
  { id: "q1", label: "Your name", type: "text", required: true },
  { id: "q2", label: "Event date", type: "text", required: true },
  { id: "q3", label: "Guest count", type: "text", required: true },
  { id: "q4", label: "Meal preference", type: "dropdown", options: ["Vegetarian", "Meat", "Vegan"], required: true },
  { id: "q5", label: "Special requests", type: "textarea", required: false },
  { id: "q6", label: "How did you hear about us?", type: "multiple_choice", options: ["Friend", "Social media", "Search", "Other"], required: false },
];

if ((db.prepare("SELECT COUNT(*) AS n FROM forms").get() as { n: number }).n === 0) {
  db.prepare("INSERT INTO forms (id, title, description, questions) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    "Event Booking Request",
    "Tell us about your event so we can prepare a booking.",
    JSON.stringify(SEED_QUESTIONS)
  );
}

type FormRow = Omit<Form, "questions"> & { questions: string };
type SubmissionRow = Omit<Submission, "answers"> & { answers: string };

export function listForms(): (Form & { submission_count: number })[] {
  const rows = db
    .prepare(
      `SELECT f.*, COUNT(s.id) AS submission_count
       FROM forms f LEFT JOIN submissions s ON s.form_id = f.id
       GROUP BY f.id ORDER BY f.created_at DESC`
    )
    .all() as (FormRow & { submission_count: number })[];
  return rows.map((r) => ({ ...r, questions: JSON.parse(r.questions) }));
}

export function getForm(id: string): Form | undefined {
  const row = db.prepare("SELECT * FROM forms WHERE id = ?").get(id) as FormRow | undefined;
  return row && { ...row, questions: JSON.parse(row.questions) };
}

export function createForm(title: string, questions: Question[], description = ""): string {
  const id = randomUUID();
  db.prepare("INSERT INTO forms (id, title, description, questions) VALUES (?, ?, ?, ?)").run(
    id,
    title,
    description,
    JSON.stringify(questions)
  );
  return id;
}

export function deleteForm(id: string): boolean {
  return db.transaction(() => {
    db.prepare("DELETE FROM submissions WHERE form_id = ?").run(id);
    return db.prepare("DELETE FROM forms WHERE id = ?").run(id).changes > 0;
  })();
}

export function listSubmissions(formId: string): Submission[] {
  const rows = db
    .prepare("SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC")
    .all(formId) as SubmissionRow[];
  return rows.map((r) => ({ ...r, answers: JSON.parse(r.answers) }));
}

export function createSubmission(formId: string, answers: Answers, via: "form" | "ai" = "form"): string {
  const id = randomUUID();
  db.prepare("INSERT INTO submissions (id, form_id, answers, via) VALUES (?, ?, ?, ?)").run(
    id,
    formId,
    JSON.stringify(answers),
    via
  );
  return id;
}

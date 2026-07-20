import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Answers, Form, Question, Submission } from "./types.ts";

type FormRow = Omit<Form, "questions"> & { questions: string };
type SubmissionRow = Omit<Submission, "answers"> & { answers: string };

let db: Database.Database | null = null;

/** Seed doubles as demo data and AI-test fixture (docs/prd.md, Fixtures & testing). */
export const SEED_QUESTIONS: Question[] = [
  { id: "q1", label: "Your name", type: "text", required: true },
  { id: "q2", label: "Event date", type: "text", required: true },
  { id: "q3", label: "Guest count", type: "text", required: true },
  { id: "q4", label: "Meal preference", type: "dropdown", options: ["Vegetarian", "Meat", "Vegan"], required: true },
  { id: "q5", label: "Special requests", type: "textarea", required: false },
  { id: "q6", label: "How did you hear about us?", type: "multiple_choice", options: ["Friend", "Social media", "Search", "Other"], required: false },
];

/** Second seed: detailed venue profile; exercises all 7 question types. */
export const RESTAURANT_SEED_QUESTIONS: Question[] = [
  { id: "q1", label: "Restaurant name", type: "text", required: true },
  { id: "q2", label: "Cuisine type", type: "dropdown", options: ["Italian", "Mexican", "Japanese", "American", "Mediterranean", "Other"], required: true },
  { id: "q3", label: "Street address", type: "text", required: true },
  { id: "q4", label: "Seated guest capacity", type: "text", required: true },
  { id: "q5", label: "Number of tables", type: "text", required: false },
  { id: "q6", label: "Price range", type: "dropdown", options: ["Budget", "Moderate", "Upscale", "Fine dining"], required: true },
  { id: "q7", label: "Alcohol service", type: "multiple_choice", options: ["Full bar", "Beer and wine only", "BYOB", "No alcohol service"], required: true },
  { id: "q8", label: "Amenities", type: "checkbox", options: ["Private dining room", "Outdoor patio", "Wheelchair accessible", "On-site parking", "Projector and sound system", "Live music"], required: true },
  { id: "q9", label: "Private-event experience (1 = first event, 5 = seasoned)", type: "rating", max: 5, required: false },
  { id: "q10", label: "Earliest availability date", type: "date", required: true },
  { id: "q11", label: "Contact email", type: "text", required: true },
  { id: "q12", label: "Anything else we should know?", type: "textarea", required: false },
];

/** Third seed: a deliberately long form (20 questions) to demo AI fill/chat at scale. */
export const VENDOR_SEED_QUESTIONS: Question[] = [
  { id: "q1", label: "Business name", type: "text", required: true },
  { id: "q2", label: "Vendor category", type: "dropdown", options: ["Catering", "Photography", "Music and DJ", "Florals", "Venue styling", "Transportation", "Other"], required: true },
  { id: "q3", label: "Years in business", type: "text", required: true },
  { id: "q4", label: "Business address", type: "text", required: true },
  { id: "q5", label: "Contact person", type: "text", required: true },
  { id: "q6", label: "Contact email", type: "text", required: true },
  { id: "q7", label: "Contact phone", type: "text", required: true },
  { id: "q8", label: "Website or portfolio link", type: "text", required: false },
  { id: "q9", label: "Services offered", type: "checkbox", options: ["On-site staff", "Delivery and setup", "Teardown and cleanup", "Custom design consultations", "Equipment rentals", "Day-of coordination"], required: true },
  { id: "q10", label: "Service area", type: "dropdown", options: ["Portland metro", "Willamette Valley", "Oregon statewide", "Pacific Northwest", "Nationwide"], required: true },
  { id: "q11", label: "Typical event size", type: "dropdown", options: ["Under 25 guests", "25-75 guests", "75-150 guests", "150-300 guests", "300+ guests"], required: true },
  { id: "q12", label: "Insurance coverage", type: "multiple_choice", options: ["Fully insured", "Liability only", "Not insured"], required: true },
  { id: "q13", label: "Preferred payment structure", type: "multiple_choice", options: ["Deposit plus balance", "Full prepayment", "Installments", "Net-30 invoice"], required: true },
  { id: "q14", label: "Dietary accommodations", type: "checkbox", options: ["Vegetarian", "Vegan", "Gluten-free", "Kosher", "Halal", "Nut-free"], required: false },
  { id: "q15", label: "Event experience (1 = new, 10 = veteran)", type: "rating", max: 10, required: true },
  { id: "q16", label: "Earliest booking date", type: "date", required: true },
  { id: "q17", label: "Cancellation policy summary", type: "textarea", required: true },
  { id: "q18", label: "Awards or press mentions", type: "textarea", required: false },
  { id: "q19", label: "How did you hear about our vendor network?", type: "multiple_choice", options: ["Referral", "Social media", "Trade show", "Search", "Other"], required: false },
  { id: "q20", label: "Anything else we should know?", type: "textarea", required: false },
];

function resolveDbPath(): string {
  return process.env.PARTY_TE_DB ?? path.join(process.cwd(), "var", "data.db");
}

function getDb(): Database.Database {
  if (db) return db;
  const file = resolveDbPath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
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

  const hasColumn = (table: string, column: string) =>
    (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  if (!hasColumn("forms", "description")) {
    database.exec("ALTER TABLE forms ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!hasColumn("submissions", "via")) {
    database.exec("ALTER TABLE submissions ADD COLUMN via TEXT NOT NULL DEFAULT 'form'");
  }

  // Seed per-title (not only-when-empty) so fixture forms appear in existing
  // dev DBs too; a deleted seed form resurrects on next start — acceptable
  // for demo/fixture data.
  const insert = database.prepare("INSERT INTO forms (id, title, description, questions) VALUES (?, ?, ?, ?)");
  const has = database.prepare("SELECT 1 FROM forms WHERE title = ?");
  if (!has.get("Event Booking Request")) {
    insert.run(
      randomUUID(),
      "Event Booking Request",
      "Tell us about your event so we can prepare a booking.",
      JSON.stringify(SEED_QUESTIONS)
    );
  }
  if (!has.get("Restaurant Venue Profile")) {
    insert.run(
      randomUUID(),
      "Restaurant Venue Profile",
      "Tell us about your restaurant so we can match you with private-event bookings.",
      JSON.stringify(RESTAURANT_SEED_QUESTIONS)
    );
  }
  if (!has.get("Event Vendor Application")) {
    insert.run(
      randomUUID(),
      "Event Vendor Application",
      "Apply to join our preferred vendor network for weddings and private events.",
      JSON.stringify(VENDOR_SEED_QUESTIONS)
    );
  }
}

/** Close and clear the singleton so the next call re-reads PARTY_TE_DB. Test-only. */
export function resetDbForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function listForms(): (Form & { submission_count: number })[] {
  const rows = getDb()
    .prepare(
      `SELECT f.*, COUNT(s.id) AS submission_count
       FROM forms f LEFT JOIN submissions s ON s.form_id = f.id
       GROUP BY f.id ORDER BY f.created_at DESC`
    )
    .all() as (FormRow & { submission_count: number })[];
  return rows.map((r) => ({ ...r, questions: JSON.parse(r.questions) }));
}

export function getForm(id: string): Form | undefined {
  const row = getDb().prepare("SELECT * FROM forms WHERE id = ?").get(id) as FormRow | undefined;
  return row && { ...row, questions: JSON.parse(row.questions) };
}

export function createForm(title: string, questions: Question[], description = ""): string {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO forms (id, title, description, questions) VALUES (?, ?, ?, ?)")
    .run(id, title, description, JSON.stringify(questions));
  return id;
}

export function deleteForm(id: string): boolean {
  return getDb().transaction(() => {
    getDb().prepare("DELETE FROM submissions WHERE form_id = ?").run(id);
    return getDb().prepare("DELETE FROM forms WHERE id = ?").run(id).changes > 0;
  })();
}

export function listSubmissions(formId: string): Submission[] {
  const rows = getDb()
    .prepare("SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC")
    .all(formId) as SubmissionRow[];
  return rows.map((r) => ({ ...r, answers: JSON.parse(r.answers) }));
}

export function createSubmission(formId: string, answers: Answers, via: "form" | "ai" = "form"): string {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO submissions (id, form_id, answers, via) VALUES (?, ?, ?, ?)")
    .run(id, formId, JSON.stringify(answers), via);
  return id;
}

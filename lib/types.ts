export type QuestionType =
  | "text"
  | "textarea"
  | "multiple_choice"
  | "dropdown"
  | "checkbox"
  | "rating"
  | "date";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[]; // multiple_choice | dropdown | checkbox
  max?: number; // rating only: 3 | 5 | 7 | 10
  required: boolean;
}

/** Answers keyed by question id; string[] only for checkbox, rating stays a string ("4"). */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export interface Form {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  created_at: string;
}

export interface Submission {
  id: string;
  form_id: string;
  answers: Answers;
  via: "form" | "ai";
  created_at: string;
}

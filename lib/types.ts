export type QuestionType = "text" | "textarea" | "multiple_choice" | "dropdown";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
}

/** Answers keyed by question id; all values are strings. */
export type Answers = Record<string, string>;

export interface Form {
  id: string;
  title: string;
  questions: Question[];
  created_at: string;
}

export interface Submission {
  id: string;
  form_id: string;
  answers: Answers;
  created_at: string;
}

import type { Answers, Question } from "./types.ts";
import { isAnswered } from "./validate.ts";

/**
 * Stable order for staggering extracted answers into form fields:
 * form question order, only ids that have an answered value.
 */
export function revealAnswerOrder(questions: Question[], answers: Answers): string[] {
  return questions.filter((q) => isAnswered(answers[q.id])).map((q) => q.id);
}

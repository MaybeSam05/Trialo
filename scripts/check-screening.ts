// Regression checks for screening rules and scoring. Run with `npm test` (no database or network needed).
import assert from "node:assert/strict";
import { interviewProgress } from "@/components/participant/progress";
import { answerEvidence, applies, DEMO_QUESTIONS, matchQuestions, sessionQuestions, type Question } from "@/lib/questions";

let failures = 0;
function check(name: string, run: () => void) {
  try { run(); console.log(`ok   ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n     ${error instanceof Error ? error.message : error}`); }
}

const [asthma, inhaler] = DEMO_QUESTIONS;
const status = (answers: Record<string, string>, questions: Question[] = DEMO_QUESTIONS) => matchQuestions(answers, questions)[0].status;
const profile = { age: "34", gender: "female" };

// 1. Uncertain answers are missing information, never evidence of exclusion.
for (const unsure of ["not sure", "Not sure.", "I'm not sure", "I don't know", "no idea", "maybe", "I'd rather not say"]) {
  check(`"${unsure}" to a parent question keeps its follow-up and needs review`, () => {
    const answers = { ...profile, asthma: unsure, smokes: "no" };
    assert.equal(applies(inhaler, answers, DEMO_QUESTIONS), true);
    assert.equal(answerEvidence(asthma, answers, DEMO_QUESTIONS), "verify");
    assert.equal(answerEvidence(inhaler, answers, DEMO_QUESTIONS), "verify");
    assert.equal(status(answers), "needs_information");
  });
}
check("unclear gender keeps a gender-only question in", () => {
  const questions: Question[] = [{ key: "group", text: "Join a women's group?", kind: "include", trial: "T", when: { key: "gender", equals: "female" } }];
  assert.equal(status({ age: "30", gender: "prefer not to say", group: "yes" }, questions), "potential_match");
  assert.equal(status({ age: "30", gender: "not sure" }, questions), "needs_information");
});
check("progress keeps the follow-up in the total after an unsure answer", () => {
  assert.equal(interviewProgress({ ...profile, asthma: "not sure" }, DEMO_QUESTIONS).total, 5);
});

// 2. Confirmed answers still exclude.
check("confirmed no to a parent drops the follow-up and is a possible exclusion", () => {
  const answers = { ...profile, asthma: "no", smokes: "no" };
  assert.equal(applies(inhaler, answers, DEMO_QUESTIONS), false);
  assert.equal(status(answers), "possible_exclusion");
  assert.equal(interviewProgress(answers, DEMO_QUESTIONS).total, 4);
});
check("confirmed yes to a flag question is a possible exclusion", () => {
  assert.equal(status({ ...profile, asthma: "yes", inhaler_weekly: "yes", smokes: "yes" }), "possible_exclusion");
});
check("confirmed gender mismatch rules a gender-only fit question out", () => {
  const questions: Question[] = [{ key: "group", text: "Join a women's group?", kind: "include", trial: "T", when: { key: "gender", equals: "female" } }];
  assert.equal(status({ age: "30", gender: "male" }, questions), "possible_exclusion");
});
check("age below the minimum rules a fit question out", () => {
  assert.equal(status({ age: "10", gender: "male", smokes: "no" }), "possible_exclusion");
});
check("all fits answered yes and no flags is a potential match", () => {
  assert.equal(status({ ...profile, asthma: "yes", inhaler_weekly: "yes", smokes: "no" }), "potential_match");
});

// 3. Each session uses the questions it started with; campaign edits only affect new sessions.
// An edit made mid-interview: the smoking flag becomes a fit question, the inhaler follow-up is removed and a new flag is added.
const EDITED: Question[] = [
  asthma,
  { key: "smokes", text: "Do you currently smoke or vape?", kind: "include", trial: "Asthma study" },
  { key: "recent_cold", text: "Have you had a cold in the last two weeks?", kind: "exclude", trial: "Asthma study" },
];
const finished = { ...profile, asthma: "yes", inhaler_weekly: "yes", smokes: "no" };

check("a session started before an edit keeps scoring with its own questions", () => {
  const { questions, fromCampaign } = sessionQuestions(DEMO_QUESTIONS, EDITED);
  assert.equal(fromCampaign, false);
  assert.deepEqual(questions, DEMO_QUESTIONS);
  assert.equal(status(finished, questions!), "potential_match");
  // Scored against the edited campaign, the same answers would have read as an exclusion.
  assert.equal(status(finished, EDITED), "possible_exclusion");
});
check("progress mid-interview uses the session's questions after an edit", () => {
  const { questions } = sessionQuestions(DEMO_QUESTIONS, EDITED);
  const progress = interviewProgress({ ...profile, asthma: "yes" }, questions);
  assert.equal(progress.total, 5);
  assert.equal(progress.current, 4);
});
check("a historical report keeps the evidence from the questions that were asked", () => {
  const { questions } = sessionQuestions(DEMO_QUESTIONS, EDITED);
  assert.equal(answerEvidence(questions![1], finished, questions!), "supports"); // inhaler, removed from the campaign later
  assert.equal(answerEvidence(questions![2], finished, questions!), "supports"); // "no" to the original smoking flag
});
check("an empty saved list is still the session's own copy", () => {
  assert.deepEqual(sessionQuestions([], EDITED), { questions: [], fromCampaign: false });
});
check("legacy sessions without a saved copy fall back to the campaign's questions and say so", () => {
  assert.deepEqual(sessionQuestions(undefined, EDITED), { questions: EDITED, fromCampaign: true });
  assert.deepEqual(sessionQuestions(null, EDITED), { questions: EDITED, fromCampaign: true });
});
check("legacy keyword-matching campaigns (no question list) stay on legacy matching", () => {
  assert.deepEqual(sessionQuestions(null, null), { questions: null, fromCampaign: false });
});

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nAll checks passed");

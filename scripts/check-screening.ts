// Regression checks for screening rules and scoring. Run with `npm test` (no database or network needed).
import assert from "node:assert/strict";
import { interviewState, sessionProgress } from "@/components/dashboard/session-outcome";
import { endReasonFor, interviewEnding, interviewProgress } from "@/components/participant/progress";
import { postCallUpdate } from "@/lib/post-call";
import { answerEvidence, answerProgress, applies, DEMO_QUESTIONS, matchQuestions, NAME_FIELD, sessionQuestions, type Question } from "@/lib/questions";
import { requestJson } from "@/lib/request";

// Checks run in order (some are async); failures are counted and reported at the end.
const checks: [string, () => void | Promise<void>][] = [];
const check = (name: string, run: () => void | Promise<void>) => { checks.push([name, run]); };

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

// 4. Dashboard and report progress: one set of applicable questions for both numbers.
check("typed name, age and gender before screening: 2 of 5, not 3 of 3", () => {
  assert.deepEqual(answerProgress({ [NAME_FIELD]: "Sam", ...profile }, DEMO_QUESTIONS), { answered: 2, total: 5, complete: false });
});
check("a conditional question ruled out by a confirmed answer leaves the total", () => {
  assert.deepEqual(answerProgress({ ...profile, asthma: "no", smokes: "no" }, DEMO_QUESTIONS), { answered: 4, total: 4, complete: true });
});
check("a correction that rules out an answered follow-up stops counting it", () => {
  // Answered the inhaler question, then corrected asthma to no: the inhaler answer no longer applies.
  assert.deepEqual(answerProgress({ ...profile, asthma: "no", inhaler_weekly: "yes" }, DEMO_QUESTIONS), { answered: 3, total: 4, complete: false });
});
check("a skipped question keeps the screening incomplete even when later ones are answered", () => {
  const answers = { ...profile, asthma: "yes", smokes: "no" }; // inhaler skipped
  assert.deepEqual(answerProgress(answers, DEMO_QUESTIONS), { answered: 4, total: 5, complete: false });
  assert.equal(interviewProgress(answers, DEMO_QUESTIONS).finished, true); // the counter's position passes it…
  assert.equal(interviewEnding(answers, DEMO_QUESTIONS, false, "agent"), "cut"); // …but that isn't completion
});
check("an unsure answer counts as answered", () => {
  assert.equal(answerProgress({ ...profile, asthma: "not sure", inhaler_weekly: "yes", smokes: "no" }, DEMO_QUESTIONS).complete, true);
});
check("legacy sessions: no question list means no total, name excluded, stored status decides", () => {
  assert.deepEqual(answerProgress({ [NAME_FIELD]: "Sam", diabetes: "yes" }, null), { answered: 1, total: null, complete: false });
  assert.equal(sessionProgress({ status: "completed", answers: { diabetes: "yes" } }, null).complete, true);
});
check("a stored \"completed\" status from the old webhook doesn't make a partial session complete", () => {
  assert.equal(sessionProgress({ status: "completed", answers: { ...profile } }, DEMO_QUESTIONS).complete, false);
});

// 5. Completion, stopping early, connection failure and transcripts are told apart.
const full = { ...profile, asthma: "yes", inhaler_weekly: "yes", smokes: "no" };
const partial = { ...profile, asthma: "yes" };
check("participant: all answered is complete however the call ended", () => {
  assert.equal(interviewEnding(full, DEMO_QUESTIONS, false, "agent"), "complete");
  assert.equal(interviewEnding(full, DEMO_QUESTIONS, true, "user"), "complete");
});
check("participant: pressing End early is stopped, not all done", () => {
  assert.equal(interviewEnding(partial, DEMO_QUESTIONS, true, "user"), "stopped");
  assert.equal(endReasonFor("user", true), "participant");
});
check("participant: Ollie hanging up early is a cut call, not all done", () => {
  assert.equal(interviewEnding(partial, DEMO_QUESTIONS, false, "agent"), "cut");
  assert.equal(endReasonFor("agent", false), "agent");
});
check("participant: a dropped connection is recorded as a connection failure", () => {
  assert.equal(endReasonFor("error", false), "connection");
  assert.equal(endReasonFor("error", true), "connection");
});
const board = (overrides: Partial<Parameters<typeof interviewState>[0]>) => interviewState({ complete: false, answered: 3, hasTranscript: false, endReason: null, recent: false, ...overrides });
check("coordinator: a transcript alone doesn't make a partial interview complete", () => {
  assert.equal(board({ hasTranscript: true }).label, "Stopped early");
  assert.equal(board({ hasTranscript: true }).live, false);
});
check("coordinator: early stop, dropped connection and agent hang-up are distinguished", () => {
  assert.match(board({ endReason: "participant" }).detail, /Participant ended the call/);
  assert.match(board({ endReason: "connection" }).detail, /Connection dropped/);
  assert.match(board({ endReason: "agent" }).detail, /Ollie's call ended/);
});
check("coordinator: recent activity with no end recorded is in progress; an ended call isn't", () => {
  assert.equal(board({ recent: true }).label, "In progress");
  assert.equal(board({ recent: true, endReason: "participant" }).label, "Stopped early");
});
check("coordinator: normal completion, with or without the transcript yet", () => {
  assert.equal(board({ complete: true, hasTranscript: true }).label, "Complete");
  assert.match(board({ complete: true }).detail, /transcript not received yet/);
});
check("webhook: stores only the transcript, never a status, and repeats are identical", () => {
  const payload = { type: "post_call_transcription", data: { conversation_id: "conv_1", transcript: [{ role: "agent", message: "Hi" }] } };
  const first = postCallUpdate(payload);
  assert.deepEqual(first, { conversationId: "conv_1", transcript: [{ role: "agent", message: "Hi" }] });
  assert.deepEqual(postCallUpdate(payload), first);
  assert.equal(first && "status" in first, false);
});
check("webhook: no transcript (e.g. an audio webhook) stores nothing; no conversation ID is rejected", () => {
  assert.equal(postCallUpdate({ type: "post_call_audio", data: { conversation_id: "conv_1" } }), null);
  assert.deepEqual(postCallUpdate({ data: {} }), { error: "Missing conversation ID." });
});

// 6. Failed save/create requests always resolve with a usable message.
const realFetch = globalThis.fetch;
async function withFetch(fake: () => Promise<Response>, run: () => Promise<void>) {
  globalThis.fetch = fake as typeof fetch;
  try { await run(); } finally { globalThis.fetch = realFetch; }
}
check("request: network failure", () => withFetch(() => Promise.reject(new TypeError("Failed to fetch")), async () => {
  const result = await requestJson("/api/studies", { method: "POST" }, "create the campaign");
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /no connection/);
}));
check("request: HTML gateway error page", () => withFetch(async () => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }), async () => {
  const result = await requestJson("/api/studies", { method: "POST" }, "create the campaign");
  assert.deepEqual(result, { ok: false, error: "Couldn't create the campaign (server error 502). Please try again." });
}));
check("request: JSON server error keeps the server's message", () => withFetch(async () => Response.json({ error: "Sign in to continue." }, { status: 401 }), async () => {
  assert.deepEqual(await requestJson("/api/studies/x", { method: "PUT" }, "save your changes"), { ok: false, error: "Sign in to continue." });
}));
check("request: success with a non-JSON body is an error, not a crash", () => withFetch(async () => new Response("ok", { status: 200 }), async () => {
  assert.equal((await requestJson("/api/studies/x", { method: "PUT" }, "save your changes")).ok, false);
}));
check("request: success", () => withFetch(async () => Response.json({ slug: "abc" }), async () => {
  assert.deepEqual(await requestJson("/api/studies", { method: "POST" }, "create the campaign"), { ok: true, body: { slug: "abc" } });
}));

async function main() {
  let failures = 0;
  for (const [name, run] of checks) {
    try { await run(); console.log(`ok   ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n     ${error instanceof Error ? error.message : error}`); }
  }
  if (failures) { console.error(`\n${failures} of ${checks.length} checks failed`); process.exit(1); }
  console.log(`\nAll ${checks.length} checks passed`);
}
void main();

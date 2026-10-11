// Regression checks for screening rules and scoring. Run with `npm test` (no database or network needed).
import assert from "node:assert/strict";
import { interviewState, sessionProgress } from "@/components/dashboard/session-outcome";
import { endReasonFor, interviewEnding, interviewProgress } from "@/components/participant/progress";
import { postCallUpdate } from "@/lib/post-call";
import { answerEvidence, answerProgress, applies, DEMO_QUESTIONS, matchQuestions, NAME_FIELD, sessionQuestions, type Question } from "@/lib/questions";
import { requestJson } from "@/lib/request";
import { AnswerQueue, type SendResult } from "@/components/participant/answer-queue";
import { saveAnswer, type AnswerStore, type SessionPatch, type StoredSession } from "@/lib/save-answer";
import { answerFromAge, otherStudyFits, questionTopic, type Campaign } from "@/lib/cross-match";

// Checks run in order (some are async); failures are counted and reported at the end.
const checks: [string, () => void | Promise<void>][] = [];
const check = (name: string, run: () => void | Promise<void>) => { checks.push([name, run]); };

const [asthma, inhaler] = DEMO_QUESTIONS;
const status = (answers: Record<string, string>, questions: Question[] = DEMO_QUESTIONS) => matchQuestions(answers, questions)[0].status;
const profile = { age: "34", gender: "female" };
const full5 = () => ({ ...profile, asthma: "yes", inhaler_weekly: "yes", smokes: "no" });

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
  // Kept in (still asked), but a yes can't confirm a match while the gender it depends on is unknown.
  assert.equal(applies(questions[0], { age: "30", gender: "prefer not to say" }, questions), true);
  assert.equal(status({ age: "30", gender: "prefer not to say", group: "yes" }, questions), "needs_information");
  assert.equal(status({ age: "30", gender: "not sure" }, questions), "needs_information");
});
check("progress keeps the follow-up in the total after an unsure answer", () => {
  assert.equal(interviewProgress({ ...profile, asthma: "not sure" }, DEMO_QUESTIONS).total, 5);
});

// 1b. Unknown age or conditions can't produce a match; confirmed answers still decide.
const fullAsthma = { gender: "female", asthma: "yes", inhaler_weekly: "yes", smokes: "no" };
for (const age of ["not sure", "I'd rather not say", ""]) {
  check(`age ${JSON.stringify(age)} with a minimum-age criterion needs review, not a match`, () => {
    const answers = age ? { ...fullAsthma, age } : fullAsthma;
    assert.equal(status(answers), "needs_information");
    assert.equal(answerEvidence(asthma, answers, DEMO_QUESTIONS), "verify");
    assert.equal(applies(asthma, answers, DEMO_QUESTIONS), true); // still asked
  });
}
check("a known age that meets the minimum still matches", () => {
  assert.equal(status({ ...fullAsthma, age: "34" }), "potential_match");
});
check("unknown age doesn't hide a confirmed exclusion from another answer", () => {
  assert.equal(status({ ...fullAsthma, age: "not sure", smokes: "yes" }), "possible_exclusion");
});
check("unknown age with a confirmed no to a requirement is still a possible exclusion", () => {
  assert.equal(status({ ...fullAsthma, age: "not sure", asthma: "no" }), "possible_exclusion");
});
check("a follow-up whose parent depends on an unknown age can't match either", () => {
  assert.equal(answerEvidence(inhaler, { ...fullAsthma, age: "not sure" }, DEMO_QUESTIONS), "verify");
});
check("a flag answered yes under an unconfirmed condition needs review rather than excluding", () => {
  const questions: Question[] = [{ key: "pregnant", text: "Are you pregnant?", kind: "exclude", trial: "T", when: { key: "gender", equals: "female" } }];
  assert.equal(status({ age: "30", gender: "prefer not to say", pregnant: "yes" }, questions), "needs_information");
  assert.equal(status({ age: "30", gender: "female", pregnant: "yes" }, questions), "possible_exclusion");
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
  // The participant's counter agrees: at the end, but 4 of 5 answered (80%), never "all done".
  assert.deepEqual(interviewProgress(answers, DEMO_QUESTIONS), { answered: 4, total: 5, current: 5, finished: false, atEnd: true, percent: 80 });
  assert.equal(interviewEnding(answers, DEMO_QUESTIONS, false, "agent"), "cut");
});
check("participant counter: every applicable question answered is finished at 100%", () => {
  assert.deepEqual(interviewProgress(full5(), DEMO_QUESTIONS), { answered: 5, total: 5, current: 5, finished: true, atEnd: false, percent: 100 });
});
check("participant counter: a correction counts once and doesn't move the position back", () => {
  const corrected = { ...full5(), age: "35" }; // age re-saved after later answers
  assert.equal(interviewProgress(corrected, DEMO_QUESTIONS).answered, 5);
  assert.equal(interviewProgress({ ...profile, asthma: "yes", inhaler_weekly: "no" }, DEMO_QUESTIONS).current, 5);
});
check("participant counter: a confirmed no drops the follow-up from the total, so it can still finish", () => {
  assert.equal(interviewProgress({ ...profile, asthma: "no", smokes: "no" }, DEMO_QUESTIONS).finished, true);
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

// 7. One interview, many studies: comparing answers with other campaigns' criteria.
const GLP1: Campaign = { slug: "glp1", name: "GLP-1 study", questions: [
  { key: "adult", text: "Are you between 18 and 75 years old?", kind: "include", trial: "GLP-1" },
  { key: "t2d", text: "Has a doctor told you that you have type 2 diabetes?", kind: "include", trial: "GLP-1" },
  { key: "metformin", text: "Do you take metformin for your blood sugar?", kind: "include", trial: "GLP-1" },
] };
const HEART: Campaign = { slug: "heart", name: "Heart study", questions: [
  { key: "diabetes_any", text: "Have you been diagnosed with type 2 diabetes?", kind: "include", trial: "Heart" },
  { key: "other_trial", text: "Are you in another clinical trial right now?", kind: "exclude", trial: "Heart" },
] };
const KIDNEY: Campaign = { slug: "kidney", name: "Kidney study", questions: [
  { key: "age_40_plus", text: "Are you 40 or older?", kind: "include", trial: "Kidney" },
  { key: "recent_trial", text: "Have you taken part in another clinical trial in the last 30 days?", kind: "exclude", trial: "Kidney" },
] };
const ALL = [GLP1, HEART, KIDNEY];
const fitOf = (answers: Record<string, string>, own: Campaign, slug: string) => otherStudyFits(answers, own.questions, ALL, own.slug).find((study) => study.slug === slug);

check("cross-study: the same question in different wording is recognised", () => {
  assert.equal(questionTopic("Has a doctor told you that you have type 2 diabetes?"), questionTopic("Have you been diagnosed with type 2 diabetes?"));
});
check("cross-study: different time frames never count as the same question", () => {
  assert.notEqual(questionTopic("Are you in another clinical trial right now?"), questionTopic("Have you taken part in another clinical trial in the last 30 days?"));
});
check("cross-study: age questions are answered from the stated age", () => {
  assert.equal(answerFromAge("Are you 40 or older?", "52"), "yes");
  assert.equal(answerFromAge("Are you between 18 and 75 years old?", "80"), "no");
  assert.equal(answerFromAge("Do you take metformin?", "52"), null);
  assert.equal(answerFromAge("Are you 40 or older?", "prefer not to say"), null);
});
check("cross-study: a shared answer that fits and nothing against is needs review, with its source", () => {
  const heart = fitOf({ age: "52", gender: "female", adult: "yes", t2d: "Yes", metformin: "yes" }, GLP1, "heart")!;
  assert.equal(heart.fit, "possible");
  assert.equal(heart.criteria.find((criterion) => criterion.evidence === "supports")?.from, "Has a doctor told you that you have type 2 diabetes?");
  assert.equal(heart.criteria.find((criterion) => criterion.text.includes("right now"))?.evidence, "not_asked");
});
check("cross-study: every criterion fitting is a potential match", () => {
  const glp1 = fitOf({ age: "52", gender: "male", diabetes_any: "yes", other_trial: "no" }, HEART, "glp1");
  assert.equal(glp1?.fit, "possible"); // metformin never asked
  const both: Campaign = { slug: "both", name: "Both", questions: [{ ...HEART.questions![0], trial: "B" }, { key: "older", text: "Are you 50 or older?", kind: "include", trial: "B" }] };
  assert.equal(otherStudyFits({ age: "52", diabetes_any: "yes" }, HEART.questions, [both], "heart")[0].fit, "match");
});
check("cross-study: a confirmed answer against a criterion is unlikely; unclear answers aren't", () => {
  assert.equal(fitOf({ age: "30", gender: "male", adult: "yes", t2d: "yes" }, GLP1, "kidney")?.fit, "unlikely");
  assert.equal(fitOf({ age: "52", t2d: "not sure" }, GLP1, "heart")?.fit, "unknown");
});
check("cross-study: the participant's own campaign is left out and no overlap is unknown", () => {
  const studies = otherStudyFits({}, GLP1.questions, ALL, "glp1");
  assert.equal(studies.some((study) => study.slug === "glp1"), false);
  assert.ok(studies.every((study) => study.fit === "unknown"));
});

// 8. Answer saving: ordered, retried, never overwriting a newer answer, honest about failures.
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** A fake server: `plan` decides each attempt's result; records what was sent, in order, and how many were in flight at once. */
function fakeServer(plan: (field: string, value: string, attempt: number) => SendResult | Promise<SendResult>) {
  const sent: string[] = [];
  const stored: Record<string, string> = {};
  const attempts = new Map<string, number>();
  let inFlight = 0; let maxInFlight = 0;
  const send = async (field: string, value: string): Promise<SendResult> => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    const n = (attempts.get(`${field}=${value}`) ?? 0) + 1; attempts.set(`${field}=${value}`, n);
    sent.push(`${field}=${value}`);
    await tick();
    const result = await plan(field, value, n);
    if (result === "ok") stored[field] = value;
    inFlight--;
    return result;
  };
  return { send, sent, stored, maxInFlight: () => maxInFlight };
}
const fastQueue = (server: ReturnType<typeof fakeServer>, saved: Record<string, string> = {}) =>
  new AnswerQueue(server.send, () => {}, (field, value) => { saved[field] = value; }, () => tick());

check("save queue: transient failures are retried until saved", async () => {
  const server = fakeServer((_f, _v, attempt) => attempt < 3 ? "retry" : "ok");
  const queue = fastQueue(server);
  assert.equal(await queue.save("age", "34"), "saved");
  assert.equal(server.sent.length, 3);
  assert.deepEqual(queue.state(), { pending: 0, failed: 0, retryable: 0 });
});
check("save queue: answers go one at a time, in order", async () => {
  const server = fakeServer(() => "ok");
  const queue = fastQueue(server);
  await Promise.all([queue.save("age", "34"), queue.save("gender", "female"), queue.save("asthma", "yes")]);
  assert.deepEqual(server.sent, ["age=34", "gender=female", "asthma=yes"]);
  assert.equal(server.maxInFlight(), 1);
});
check("save queue: giving up after bounded retries keeps the answer for a manual retry", async () => {
  let down = true;
  const server = fakeServer(() => down ? "retry" : "ok");
  const saved: Record<string, string> = {};
  const queue = fastQueue(server, saved);
  assert.equal(await queue.save("asthma", "yes"), "failed");
  assert.equal(server.sent.length, 4); // first try + 3 retries, then stop
  assert.deepEqual(queue.state(), { pending: 0, failed: 1, retryable: 1 });
  assert.equal(saved.asthma, undefined); // never counted as saved
  down = false;
  queue.retryFailed();
  await tick(); await tick(); await tick();
  assert.equal(server.stored.asthma, "yes");
  assert.deepEqual(queue.state(), { pending: 0, failed: 0, retryable: 0 });
});
check("save queue: a permanent server refusal isn't retried and can't be retried", async () => {
  const server = fakeServer(() => "fail");
  const queue = fastQueue(server);
  assert.equal(await queue.save("age", "34"), "failed");
  assert.equal(server.sent.length, 1);
  assert.deepEqual(queue.state(), { pending: 0, failed: 1, retryable: 0 });
});
check("save queue: a correction replaces an older answer still waiting to be sent", async () => {
  let release!: () => void;
  const gate = new Promise<SendResult>((resolve) => { release = () => resolve("ok"); });
  const server = fakeServer((field) => field === "age" ? gate : "ok");
  const queue = fastQueue(server);
  const age = queue.save("age", "34");               // in flight, held
  const first = queue.save("asthma", "yes");         // queued
  const corrected = queue.save("asthma", "no");      // replaces the queued "yes"
  release();
  assert.deepEqual(await Promise.all([age, first, corrected]), ["saved", "replaced", "saved"]);
  assert.deepEqual(server.sent, ["age=34", "asthma=no"]);
  assert.equal(server.stored.asthma, "no");
});
check("save queue: a correction made while the older answer is in flight is sent after it, so the newer value wins", async () => {
  const server = fakeServer(() => "ok");
  const queue = fastQueue(server);
  const older = queue.save("asthma", "yes");
  await tick(); // "yes" is now in flight
  const newer = queue.save("asthma", "no");
  await Promise.all([older, newer]);
  assert.deepEqual(server.sent, ["asthma=yes", "asthma=no"]);
  assert.equal(server.stored.asthma, "no");
});
check("save queue: retrying a failed answer never overwrites a newer one", async () => {
  let down = true;
  const server = fakeServer((_f, value) => down && value === "yes" ? "retry" : "ok");
  const queue = fastQueue(server);
  assert.equal(await queue.save("asthma", "yes"), "failed");
  assert.equal(await queue.save("asthma", "no"), "saved"); // the correction drops the failed older answer
  down = false;
  queue.retryFailed();
  await tick(); await tick();
  assert.equal(server.stored.asthma, "no");
  assert.equal(server.sent.filter((entry) => entry === "asthma=yes").length, 4); // no extra resend of the stale value
});
check("save queue: ending the call with a save pending still finishes it and reports it as pending meanwhile", async () => {
  let release!: () => void;
  const gate = new Promise<SendResult>((resolve) => { release = () => resolve("ok"); });
  const server = fakeServer(() => gate);
  const queue = fastQueue(server);
  const last = queue.save("smokes", "no");
  await tick();
  assert.equal(queue.state().pending, 1); // the closing screen shows "Saving your last answers…", not "saved"
  release();
  assert.equal(await last, "saved");
  assert.equal(queue.state().pending, 0);
});

/** An in-memory session row with a compare-and-swap write, used to interleave two saves for real. */
function memoryStore(questions: Question[] | null, between?: () => Promise<void>): AnswerStore & { row: StoredSession & Partial<SessionPatch> } {
  const row: StoredSession & Partial<SessionPatch> = { answers: {}, updated_at: "2026-10-11T00:00:00.000Z", study_id: "study", questions };
  return {
    row,
    readSession: async () => ({ ...row, answers: { ...(row.answers ?? {}) } }),
    readStudy: async () => ({ questions, trials: [] }),
    writeIfUnchanged: async (_id, expected, patch) => {
      if (between) await between();
      if (row.updated_at !== expected) return false;
      Object.assign(row, patch);
      return true;
    },
  };
}
check("answer endpoint: two saves at once both land (no lost update)", async () => {
  // Both saves read the same row before either writes: the second write must notice and re-read.
  const store = memoryStore(DEMO_QUESTIONS, tick);
  const results = await Promise.all([saveAnswer(store, "s", "age", "34", () => 1_000), saveAnswer(store, "s", "gender", "female", () => 1_000)]);
  assert.deepEqual(results, ["saved", "saved"]);
  assert.deepEqual(store.row.answers, { age: "34", gender: "female" });
});
check("answer endpoint: updated_at always moves forward, even within the same millisecond", async () => {
  const store = memoryStore(DEMO_QUESTIONS);
  const clock = () => Date.parse("2026-10-11T00:00:00.000Z"); // frozen clock
  await saveAnswer(store, "s", "age", "34", clock);
  const first = store.row.updated_at;
  await saveAnswer(store, "s", "gender", "female", clock);
  assert.ok(Date.parse(store.row.updated_at) > Date.parse(first));
});
check("answer endpoint: completion and scoring are recomputed on every save, including corrections", async () => {
  const store = memoryStore(DEMO_QUESTIONS);
  for (const [field, value] of Object.entries(full5())) await saveAnswer(store, "s", field, value);
  assert.equal(store.row.status, "completed");
  await saveAnswer(store, "s", "smokes", "yes"); // correction
  assert.equal((store.row.match_results as { status: string }[])[0].status, "possible_exclusion");
});
check("answer endpoint: unknown session and persistent contention are reported, never claimed saved", async () => {
  const missing: AnswerStore = { readSession: async () => null, readStudy: async () => ({}), writeIfUnchanged: async () => true };
  assert.equal(await saveAnswer(missing, "s", "age", "34"), "unknown_session");
  const contended = memoryStore(DEMO_QUESTIONS);
  contended.writeIfUnchanged = async () => false;
  assert.equal(await saveAnswer(contended, "s", "age", "34"), "busy");
});

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

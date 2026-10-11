/**
 * Seeds Supabase with realistic, fully synthetic demo data for the coordinator dashboard.
 *
 *   npm run seed:demo                  replace the demo campaigns (slugs starting "demo-") and their sessions
 *   npm run seed:demo -- --clear-all   ALSO delete every other campaign and session first (wipes old test data)
 *   npx tsx scripts/seed-demo.ts --dry-run   preview the generated data without touching the database
 *
 * Demo campaigns keep the account that owned them before (usually the trialo-demo account from
 * `npm run demo:user`), so re-seeding never hides them. On a fresh database, run `npm run demo:user` after seeding.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local. No real people or health data.
 */
import { createClient } from "@supabase/supabase-js";
import { getSessionOutcome } from "@/components/dashboard/session-outcome";
import { matchQuestions, type Question } from "@/lib/questions";
import type { MatchResult } from "@/lib/types";

const dryRun = process.argv.includes("--dry-run");
const clearAll = process.argv.includes("--clear-all");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!url || !key)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local.");
  process.exit(1);
}
const supabase = dryRun ? null! : createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

// Deterministic randomness so every seed looks the same (relative to "now").
let state = 20261010;
const random = () => { state = (state + 0x6d2b79f5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + random() * (max - min);

type Campaign = { slug: string; name: string; weight: number; questions: Question[]; createdDaysAgo: number };

const CAMPAIGNS: Campaign[] = [
  {
    slug: "demo-glp1-newark", name: "Weekly GLP-1 Injection Study · Newark", weight: 0.45, createdDaysAgo: 19,
    questions: [
      { key: "adult_18_75", text: "Are you between 18 and 75 years old?", kind: "include", trial: "GLP-1 Weekly Study" },
      { key: "type_2_diabetes", text: "Has a doctor told you that you have type 2 diabetes?", kind: "include", trial: "GLP-1 Weekly Study" },
      { key: "takes_metformin", text: "Do you take metformin for your blood sugar?", kind: "include", trial: "GLP-1 Weekly Study" },
      { key: "pregnancy", text: "Are you pregnant, breastfeeding, or planning a pregnancy in the next year?", kind: "exclude", trial: "GLP-1 Weekly Study" },
      { key: "pancreatitis", text: "Have you ever had pancreatitis?", kind: "exclude", trial: "GLP-1 Weekly Study" },
      { key: "insulin_recent", text: "Have you used insulin in the last three months?", kind: "exclude", trial: "GLP-1 Weekly Study" },
      { key: "monthly_visits", text: "Could you visit the Newark clinic about once a month?", kind: "info", trial: "GLP-1 Weekly Study" },
    ],
  },
  {
    slug: "demo-kidney-new-brunswick", name: "Kidney Function Outcomes Study · New Brunswick", weight: 0.3, createdDaysAgo: 16,
    questions: [
      { key: "ckd_diagnosis", text: "Has a doctor told you that you have chronic kidney disease?", kind: "include", trial: "Kidney Outcomes" },
      { key: "age_40_plus", text: "Are you 40 or older?", kind: "include", trial: "Kidney Outcomes" },
      { key: "on_dialysis", text: "Are you currently on dialysis?", kind: "exclude", trial: "Kidney Outcomes" },
      { key: "organ_transplant", text: "Have you ever had an organ transplant?", kind: "exclude", trial: "Kidney Outcomes" },
      { key: "recent_trial", text: "Have you taken part in another clinical trial in the last 30 days?", kind: "exclude", trial: "Kidney Outcomes" },
      { key: "transport", text: "Do you have a way to get to appointments in New Brunswick?", kind: "info", trial: "Kidney Outcomes" },
    ],
  },
  {
    slug: "demo-heart-edison", name: "Heart Health in Diabetes (Phase 3) · Edison", weight: 0.25, createdDaysAgo: 12,
    questions: [
      { key: "diabetes_any", text: "Have you been diagnosed with type 2 diabetes?", kind: "include", trial: "Heart Health Phase 3" },
      { key: "heart_history", text: "Have you ever had a heart attack or stroke, or been told you have heart disease?", kind: "include", trial: "Heart Health Phase 3" },
      { key: "surgery_3_months", text: "Have you had surgery in the last three months?", kind: "exclude", trial: "Heart Health Phase 3" },
      { key: "other_trial", text: "Are you in another clinical trial right now?", kind: "exclude", trial: "Heart Health Phase 3" },
      { key: "blood_tests", text: "Are you comfortable having a blood test at each visit?", kind: "info", trial: "Heart Health Phase 3" },
    ],
  },
];

// How people actually answer out loud. matchQuestions reads the first word, so "I'm not sure…" stays unscored.
const YES = ["Yes", "Yes.", "Yeah", "Yep", "Yes, that's right", "Yeah, I think so"];
// Fuller "yes" answers that only make sense for particular questions.
const YES_DETAIL: Record<string, string[]> = {
  type_2_diabetes: ["Yes, for about four years", "Yes, I was diagnosed in 2019", "Yeah, a few years now"],
  diabetes_any: ["Yes, since 2017", "Yeah, about six years"],
  ckd_diagnosis: ["Yes, stage three", "Yeah, my nephrologist told me last year"],
  takes_metformin: ["Yes, twice a day", "Yes, every morning with breakfast"],
  heart_history: ["Yes, I had a stent put in a few years ago", "Yeah, a mild heart attack in 2021"],
  pregnancy: ["Yes, I'm breastfeeding right now", "Yes, we're hoping to get pregnant next year"],
  pancreatitis: ["Yes, once, a few years ago"],
  insulin_recent: ["Yes, I take some at night"],
  on_dialysis: ["Yes, three times a week"],
  organ_transplant: ["Yes, a kidney transplant in 2015"],
  recent_trial: ["Yes, a vaccine study last month"],
  surgery_3_months: ["Yes, knee surgery in August"],
  other_trial: ["Yes, I'm in a blood pressure study"],
};
const yesFor = (key: string) => YES_DETAIL[key] && random() < 0.5 ? pick(YES_DETAIL[key]) : pick(YES);
const NO = ["No", "No.", "Nope", "No, never", "No, not that I know of", "No, not currently"];
const UNSURE = ["Not sure", "I'm not sure, I'd have to check", "I don't remember", "Maybe? I'd need to ask my doctor"];
const INFO_YES = ["Yes", "Yes, I can drive there", "Probably, if it's near a bus line", "Yes, my daughter can take me", "Yes, that's fine"];
const ASK = ["", "Next question. ", "Thanks. ", "Okay. ", "Got it. "];
const CONFIRM = ["Got it, thank you.", "Thanks, I've saved that.", "Okay, noted.", "Thank you."];

type Persona = "fits" | "exclusion" | "unsure" | "abandoned" | "opened" | "live";

function answersFor(questions: Question[], persona: Persona) {
  const excludes = questions.filter((question) => question.kind === "exclude");
  const includes = questions.filter((question) => question.kind === "include");
  const flagged = persona === "exclusion" ? pick(excludes).key : null;
  // Nobody is unsure of their age; uncertainty is about diagnoses and medications.
  const unsure = persona === "unsure" ? pick(includes.filter((question) => !/age|adult/.test(question.key))).key : null;
  const count = persona === "opened" ? 0
    : persona === "abandoned" ? 1 + Math.floor(random() * (questions.length - 2))
    : persona === "live" ? 1 + Math.floor(random() * (questions.length - 2))
    : questions.length;
  const answers: Record<string, string> = {};
  for (const question of questions.slice(0, count)) {
    answers[question.key] = question.key === unsure ? pick(UNSURE)
      : question.key === flagged ? yesFor(question.key)
      : question.kind === "info" ? pick(INFO_YES)
      : question.kind === "include" ? yesFor(question.key)
      : pick(NO);
  }
  return answers;
}

function transcriptFor(campaign: Campaign, answers: Record<string, string>) {
  const turns = [
    { role: "agent", message: `Hi, I'm Ollie, an AI assistant helping the research team for the ${campaign.name.split(" · ")[0]}. This is a short pre-screening with practice data only. Is it okay if we get started?` },
    { role: "user", message: pick(["Yes, let's do it.", "Sure.", "Okay, go ahead.", "Yeah, that's fine."]) },
  ];
  // Ollie confirms the last answer and asks the next question in the same turn.
  let confirm = "";
  for (const question of campaign.questions) {
    if (!(question.key in answers)) break;
    turns.push({ role: "agent", message: `${confirm}${confirm ? "" : pick(ASK)}${question.text}` });
    turns.push({ role: "user", message: answers[question.key] });
    confirm = `${pick(CONFIRM)} `;
  }
  turns.push({ role: "agent", message: `${confirm}That's everything. A member of the research team will review your answers. This doesn't determine eligibility or enrollment. Thanks for your time!` });
  return turns;
}

// Clinic hours in New Jersey (UTC-4 in October), weekdays busier than weekends.
function clinicTime(daysAgo: number) {
  const day = new Date(Date.now() - daysAgo * 86_400_000);
  const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
  const localHour = weekend ? between(10, 15) : between(8.5, 19.5);
  day.setUTCHours(Math.floor(localHour) + 4, Math.floor((localHour % 1) * 60), Math.floor(random() * 60), 0);
  // Never in the future (or so recent it would look live).
  if (day.getTime() > Date.now() - 30 * 60_000) day.setTime(day.getTime() - 86_400_000);
  return day;
}

async function main() {
  if (dryRun) {
    CAMPAIGNS.forEach((campaign) => studyIds.set(campaign.slug, campaign.slug));
    const sessions = buildSessions();
    report(sessions);
    return;
  }
  // Keep the demo campaigns with whoever owned them, so re-seeding never hides them.
  const { data: previous } = await supabase.from("studies").select("owner_id").like("slug", "demo-%").not("owner_id", "is", null).limit(1);
  const owner = previous?.[0]?.owner_id ?? null;
  if (clearAll) {
    const { error } = await supabase.from("studies").delete().not("id", "is", null);
    if (error) throw error;
    console.log("Deleted all existing campaigns and their sessions.");
  } else {
    const { error } = await supabase.from("studies").delete().like("slug", "demo-%");
    if (error) throw error;
    console.log("Removed earlier demo campaigns (slug demo-*).");
  }

  for (const campaign of CAMPAIGNS) {
    const { data, error } = await supabase.from("studies").insert({
      slug: campaign.slug, name: campaign.name, trials: [], questions: campaign.questions, owner_id: owner,
      created_at: new Date(Date.now() - campaign.createdDaysAgo * 86_400_000).toISOString(),
    }).select("id").single();
    if (error) throw new Error(error.message.includes("questions") ? "The studies.questions column is missing. Re-run supabase/schema.sql first." : error.message);
    studyIds.set(campaign.slug, data.id);
  }

  const sessions = buildSessions();
  const { error } = await supabase.from("screening_sessions").insert(sessions);
  if (error) throw new Error(error.message.includes("questions") ? "The screening_sessions.questions column is missing. Re-run supabase/schema.sql first." : error.message);
  report(sessions);
  console.log("Two sessions show as \"Answering now\" for the next ~10 minutes.");
}

const studyIds = new Map<string, string>();

function buildSessions() {
  const now = Date.now();
  const sessions: Record<string, unknown>[] = [];
  const add = (campaign: Campaign, persona: Persona, created: Date) => {
    const answers = answersFor(campaign.questions, persona);
    const completed = persona === "fits" || persona === "exclusion" || persona === "unsure";
    const minutes = completed ? between(3, 8) : persona === "opened" ? 0 : between(1, 4);
    const updated = persona === "live" ? new Date(now - between(20, 90) * 1000) : new Date(created.getTime() + minutes * 60_000);
    sessions.push({
      study_id: studyIds.get(campaign.slug),
      status: completed ? "completed" : persona === "opened" ? "started" : "needs_review",
      elevenlabs_conversation_id: persona === "opened" ? null : `demo_conv_${sessions.length + 1}_${Math.floor(random() * 1e9).toString(36)}`,
      answers,
      questions: campaign.questions,
      match_results: Object.keys(answers).length ? matchQuestions(answers, campaign.questions) : [],
      transcript: completed ? transcriptFor(campaign, answers) : null,
      created_at: created.toISOString(),
      updated_at: updated.toISOString(),
    });
  };

  const personas: [Persona, number][] = [["fits", 0.36], ["unsure", 0.24], ["exclusion", 0.22], ["abandoned", 0.13], ["opened", 0.05]];
  const choose = <T,>(weighted: [T, number][]) => { let roll = random(); for (const [value, weight] of weighted) { if ((roll -= weight) <= 0) return value; } return weighted[0][0]; };
  for (let index = 0; index < 54; index++) {
    const campaign = choose(CAMPAIGNS.map((item) => [item, item.weight] as [Campaign, number]));
    const daysAgo = Math.min(campaign.createdDaysAgo - 1, Math.pow(random(), 1.4) * 14 + 0.3);
    add(campaign, choose(personas), clinicTime(daysAgo));
  }
  // Two people mid-interview right now.
  add(CAMPAIGNS[0], "live", new Date(now - 4 * 60_000));
  add(CAMPAIGNS[2], "live", new Date(now - 2 * 60_000));
  return sessions;
}

function report(sessions: Record<string, unknown>[]) {
  const tally = (values: string[]) => values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});
  const times = sessions.map((row) => Date.parse(String(row.created_at)));
  console.log(`${dryRun ? "Would seed" : "Seeded"} ${CAMPAIGNS.length} campaigns and ${sessions.length} sessions.`);
  console.log("By status:", tally(sessions.map((row) => String(row.status))));
  console.log("Dashboard outcome:", tally(sessions.map((row) => getSessionOutcome({ status: String(row.status), match_results: row.match_results as MatchResult[] }))));
  console.log("By campaign:", tally(sessions.map((row) => CAMPAIGNS.find((campaign) => studyIds.get(campaign.slug) === row.study_id)?.name ?? "?")));
  console.log("Started between", new Date(Math.min(...times)).toISOString(), "and", new Date(Math.max(...times)).toISOString());
  if (!dryRun) return;
  const hours = sessions.filter((row) => row.updated_at && Date.parse(String(row.updated_at)) < Date.now() - 15 * 60_000).map((row) => (new Date(String(row.created_at)).getUTCHours() + 20) % 24);
  console.log("Local start hours (ET):", Math.min(...hours), "to", Math.max(...hours), "| future timestamps:", sessions.filter((row) => Date.parse(String(row.created_at)) > Date.now() || Date.parse(String(row.updated_at)) > Date.now()).length);
  const sample = sessions.find((row) => row.status === "completed" && getSessionOutcome({ status: "completed", match_results: row.match_results as MatchResult[] }) === "needs_review");
  console.log("\nSample session answers:", sample?.answers, "\nResults:", sample?.match_results);
  console.log("Transcript (first turns):\n ", (sample?.transcript as { role: string; message: string }[]).slice(0, 7).map((turn) => `${turn.role}: ${turn.message}`).join("\n  "));
}

main().catch((error) => { console.error("Seeding failed:", error instanceof Error ? error.message : error); process.exit(1); });

/**
 * Turns Synthea output (https://github.com/synthetichealth/synthea) into the small participant file the demo seed uses,
 * scripts/data/synthea-participants.json. Synthea simulates whole synthetic medical histories; this keeps only what a
 * participant could tell Ollie: age, gender, first name, town, and the conditions, medicines and procedures the demo
 * campaigns ask about. No real people.
 *
 * 1. Generate patients with Synthea's CSV exporter (Java 17+), for example:
 *      java -jar synthea-with-dependencies.jar -p 1500 -s 20261010 -cs 20261010 -a 18-80 \
 *        --exporter.csv.export true --exporter.fhir.export false --exporter.years_of_history 10 "New Jersey"
 * 2. From the repo root: npx tsx scripts/synthea-extract.ts path/to/output/csv
 *
 * The records are read "as of" the day you run this, matching the day Synthea simulated up to.
 */
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npx tsx scripts/synthea-extract.ts path/to/synthea/output/csv");
  process.exit(1);
}
const OUT = "scripts/data/synthea-participants.json"; // run from the repo root
const asOf = new Date();
const DAY = 86_400_000;
const daysAgo = (date: string) => (asOf.getTime() - Date.parse(date)) / DAY;
const year = (date: string) => Number(date.slice(0, 4));

/** Synthea quotes fields that contain commas. */
function parseLine(line: string) {
  const fields: string[] = [];
  let field = "", quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

async function eachRow(file: string, onRow: (row: Record<string, string>) => void) {
  let header: string[] | null = null;
  for await (const line of createInterface({ input: createReadStream(join(dir, file)), crlfDelay: Infinity })) {
    if (!line) continue;
    const fields = parseLine(line);
    if (!header) { header = fields; continue; }
    onRow(Object.fromEntries(header.map((name, index) => [name, fields[index] ?? ""])));
  }
}

/** What the participant would say about each topic the demo campaigns ask about. Years and stages add detail. */
export type SyntheaFacts = {
  type2Diabetes?: { since: number };
  prediabetes?: true;
  metformin?: true;
  insulinRecent?: true;
  ckd?: { stage: string };
  dialysis?: true;
  transplant?: { organ: string; year: number };
  pregnant?: true;
  heart?: { event: string; year: number };
  recentSurgery?: { name: string };
};
export type SyntheaParticipant = { id: string; firstName: string; age: number; gender: "Female" | "Male"; city: string; facts: SyntheaFacts };

const CKD: Record<string, string> = { "431855005": "1", "431856006": "2", "433144002": "3", "431857002": "4", "46177005": "end-stage" };
const HEART: Record<string, string> = {
  "22298006": "a heart attack", "401303003": "a heart attack", "401314000": "a heart attack", "399211009": "a heart attack",
  "399261000": "bypass surgery", "414545008": "heart disease", "88805009": "heart failure", "230690007": "a stroke",
};
// Surgery a participant would mention; leaves out dental work and contraceptive devices.
const SURGERY = /ectomy|bypass|transplant|sternotomy|replacement of (?!contraceptive)|arthroplasty|lung volume reduction/i;
const NOT_SURGERY = /gingivectomy|referral|pre-surgery|evaluation|regime/i;
const plainSurgery = (description: string) => description.replace(/\s*\((procedure|regime\/therapy)\)$/, "").replace(/^Transplant of/, "Transplant of the").toLowerCase();

async function main() {
  const people = new Map<string, SyntheaParticipant>();
  await eachRow("patients.csv", (row) => {
    if (row.DEATHDATE) return;
    const age = Math.floor((asOf.getTime() - Date.parse(row.BIRTHDATE)) / (365.2425 * DAY));
    if (age < 18 || age > 80) return;
    // Synthea appends digits to names so they're unique ("Terry864").
    people.set(row.Id, { id: row.Id, firstName: row.FIRST.replace(/\d+/g, ""), age, gender: row.GENDER === "F" ? "Female" : "Male", city: row.CITY, facts: {} });
  });

  await eachRow("conditions.csv", (row) => {
    const facts = people.get(row.PATIENT)?.facts;
    if (!facts) return;
    const active = !row.STOP;
    if (row.CODE === "44054006" && active) facts.type2Diabetes = { since: year(row.START) };
    if (row.CODE === "714628002" && active) facts.prediabetes = true;
    if (CKD[row.CODE] && active) facts.ckd = { stage: CKD[row.CODE] };
    if (row.CODE === "72892002" && active) facts.pregnant = true;
    if (row.CODE === "161665007") facts.transplant ??= { organ: "kidney", year: year(row.START) };
    // Keep the most memorable heart event: an actual heart attack or bypass beats a diagnosis.
    if (HEART[row.CODE] && (!facts.heart || /disease|failure/.test(facts.heart.event))) facts.heart = { event: HEART[row.CODE], year: year(row.START) };
  });

  await eachRow("medications.csv", (row) => {
    const facts = people.get(row.PATIENT)?.facts;
    if (!facts) return;
    const current = !row.STOP || daysAgo(row.STOP) <= 0;
    if (/metformin/i.test(row.DESCRIPTION) && current) facts.metformin = true;
    if (/insulin/i.test(row.DESCRIPTION) && (!row.STOP || daysAgo(row.STOP) <= 90)) facts.insulinRecent = true;
  });

  await eachRow("procedures.csv", (row) => {
    const facts = people.get(row.PATIENT)?.facts;
    if (!facts) return;
    const ago = daysAgo(row.START);
    if (/dialysis/i.test(row.DESCRIPTION) && ago <= 30) facts.dialysis = true;
    if (/^transplant(ation)? of (?!kidney regime)/i.test(row.DESCRIPTION)) facts.transplant = { organ: row.DESCRIPTION.match(/of (\w+)/i)![1].toLowerCase(), year: year(row.START) };
    if (SURGERY.test(row.DESCRIPTION) && !NOT_SURGERY.test(row.DESCRIPTION) && ago <= 90) facts.recentSurgery = { name: plainSurgery(row.DESCRIPTION) };
  });

  // Everyone with something the demo campaigns screen for, plus enough healthy adults to answer "no" realistically.
  const all = [...people.values()].sort((a, b) => a.id.localeCompare(b.id));
  const relevant = all.filter((person) => person.facts.type2Diabetes || person.facts.ckd || person.facts.heart);
  const others = all.filter((person) => !relevant.includes(person) && person.age >= 35).slice(0, 120);
  const participants = [...relevant, ...others];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ source: "Synthea (https://github.com/synthetichealth/synthea), synthetic patients", asOf: asOf.toISOString().slice(0, 10), participants }, null, 1)}\n`);

  const count = (test: (facts: SyntheaFacts) => unknown) => participants.filter((person) => test(person.facts)).length;
  console.log(`Read ${people.size} living adults; wrote ${participants.length} to ${OUT}`);
  console.log(`Type 2 diabetes ${count((f) => f.type2Diabetes)}, metformin ${count((f) => f.metformin)}, insulin ${count((f) => f.insulinRecent)}, CKD ${count((f) => f.ckd)}, dialysis ${count((f) => f.dialysis)}, transplant ${count((f) => f.transplant)}, heart ${count((f) => f.heart)}, pregnant ${count((f) => f.pregnant)}, recent surgery ${count((f) => f.recentSurgery)}`);
}

main().catch((error) => { console.error("Extract failed:", error instanceof Error ? error.message : error); process.exit(1); });

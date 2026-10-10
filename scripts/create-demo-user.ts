/**
 * Creates (or resets) the shared demo coordinator account in Clerk and gives it every campaign
 * that has no owner yet, so the existing demo data stays visible after accounts were introduced.
 *
 *   npm run demo:user
 *
 * Prints the username and a freshly generated password. Re-running resets the password.
 * Needs CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const USERNAME = "trialo-demo";

const secretKey = process.env.CLERK_SECRET_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secretKey || !url || !serviceKey) {
  console.error("Missing CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

// Readable but strong: 4 groups of 5 characters, no look-alikes.
const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = [...randomBytes(20)].map((byte) => alphabet[byte % alphabet.length]).join("").match(/.{5}/g)!.join("-");

async function main() {
  const clerk = createClerkClient({ secretKey });
  const { data: existing } = await clerk.users.getUserList({ username: [USERNAME] });
  const user = existing[0]
    ? await clerk.users.updateUser(existing[0].id, { password, skipPasswordChecks: true })
    : await clerk.users.createUser({ username: USERNAME, password, firstName: "Trialo", lastName: "Demo" });

  const supabase = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: claimed, error } = await supabase.from("studies").update({ owner_id: user.id }).is("owner_id", null).select("slug");
  if (error) throw new Error(error.message.includes("owner_id") ? "studies.owner_id is missing. Re-run supabase/schema.sql in Supabase first." : error.message);

  console.log(`${existing[0] ? "Reset" : "Created"} demo account and gave it ${claimed?.length ?? 0} campaign(s) that had no owner.\n`);
  console.log(`  Username: ${USERNAME}`);
  console.log(`  Password: ${password}\n`);
  console.log("Sign in at /portal. Re-run this script to reset the password.");
}

main().catch((error) => {
  const detail = (error as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
  console.error("Failed:", detail?.longMessage ?? detail?.message ?? (error instanceof Error ? error.message : error));
  process.exit(1);
});

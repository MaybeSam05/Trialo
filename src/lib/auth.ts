import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * The signed-in coordinator's Clerk user ID. Every coordinator query filters studies by this
 * (studies.owner_id), so accounts only ever see the campaigns they created.
 * The proxy already sends signed-out visitors to the portal; this is the check that actually guards data.
 */
export async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/portal");
  return userId;
}

/**
 * On the portal: a visitor who is already signed in goes straight on, to where they were headed
 * (redirect_url, same-site paths only) or the dashboard. Also resolves the race where the first request
 * after signing in reaches the server a moment before the session cookie.
 */
export async function leavePortalIfSignedIn(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const { userId } = await auth();
  if (!userId) return;
  const raw = (await searchParams).redirect_url;
  let target = "/dashboard";
  try {
    const url = new URL(typeof raw === "string" ? raw : "/dashboard", "http://same-site.invalid");
    if (url.origin === "http://same-site.invalid" || url.host === (await headerHost())) target = `${url.pathname}${url.search}`;
  } catch {}
  if (target.startsWith("/portal")) target = "/dashboard";
  redirect(target);
}

async function headerHost() {
  const { headers } = await import("next/headers");
  return (await headers()).get("host");
}

/** Same, for API routes: null means respond 401. */
export async function ownerOrNull(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

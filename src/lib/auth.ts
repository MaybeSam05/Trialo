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

/** Same, for API routes: null means respond 401. */
export async function ownerOrNull(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

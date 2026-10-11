import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Shared demo coordinator account that holds the sample campaigns (see scripts/create-demo-user.ts). */
const DEMO_USERNAME = "trialo-demo";

/**
 * "Demo" button on the portal: signs the visitor into the shared demo account with a one-time,
 * short-lived Clerk sign-in token. The portal's <SignIn> picks up __clerk_ticket and finishes the sign-in.
 */
export async function GET(request: Request) {
  const portal = new URL("/portal", request.url);
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.users.getUserList({ username: [DEMO_USERNAME] });
    if (!data[0]) throw new Error("Demo account not found. Run npm run demo:user.");
    const { token } = await clerk.signInTokens.createSignInToken({ userId: data[0].id, expiresInSeconds: 120 });
    portal.searchParams.set("__clerk_ticket", token);
  } catch (error) {
    console.error("Demo sign-in failed:", error instanceof Error ? error.message : error);
    portal.searchParams.set("demo", "unavailable");
  }
  return NextResponse.redirect(portal, { headers: { "cache-control": "no-store" } });
}

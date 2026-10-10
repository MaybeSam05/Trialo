import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Participants never sign in: the interview link, its APIs and the ElevenLabs webhook stay public.
// Everything else is the coordinator workspace and needs an account.
const isPublic = createRouteMatcher([
  "/portal(.*)",
  "/s/(.*)",
  "/demo/(.*)",
  "/api/public/(.*)",
  "/api/sessions/(.*)",
  "/api/elevenlabs/(.*)",
  "/__clerk/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublic(request)) return;
  const { userId, redirectToSignIn } = await auth();
  if (userId) return;
  // APIs answer with a JSON 401 the app can show; pages go to the portal and come back after sign-in.
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return redirectToSignIn({ returnBackUrl: request.url });
}, { signInUrl: "/portal", signUpUrl: "/portal/sign-up" });

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy for its frontend API.
    "/__clerk/:path*",
  ],
};

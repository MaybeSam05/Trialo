import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Participants never sign in: the interview link, its APIs and the ElevenLabs webhook stay public.
// Everything else is the coordinator workspace and needs an account.
const isPublic = createRouteMatcher([
  "/portal(.*)",
  "/s/(.*)",
  "/demo/(.*)",
  "/api/public/(.*)",
  "/api/sessions/(.*)",
  "/api/elevenlabs/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
}, { signInUrl: "/portal", signUpUrl: "/portal/sign-up" });

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};

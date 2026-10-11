import { SignIn } from "@clerk/nextjs";
import { PortalShell, portalAppearance } from "@/components/portal/portal-shell";
import { leavePortalIfSignedIn } from "@/lib/auth";

export const metadata = { title: "Sign in · Trialo" };

export default async function PortalSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await leavePortalIfSignedIn(searchParams);
  const demoUnavailable = (await searchParams).demo === "unavailable";
  return <PortalShell demoUnavailable={demoUnavailable} title="Welcome back" lede="Sign in with your username and password to manage your screening campaigns and review sessions.">
    <SignIn path="/portal" routing="path" signUpUrl="/portal/sign-up" fallbackRedirectUrl="/dashboard" appearance={portalAppearance} />
  </PortalShell>;
}

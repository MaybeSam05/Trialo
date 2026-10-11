import { SignUp } from "@clerk/nextjs";
import { PortalShell, portalAppearance } from "@/components/portal/portal-shell";
import { leavePortalIfSignedIn } from "@/lib/auth";

export const metadata = { title: "Create an account · Trialo" };

export default async function PortalSignUp({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await leavePortalIfSignedIn(searchParams);
  const demoUnavailable = (await searchParams).demo === "unavailable";
  return <PortalShell demoUnavailable={demoUnavailable} title="Create a coordinator account" lede="Pick a username and password. Your campaigns and their sessions are private to your account.">
    <SignUp path="/portal/sign-up" routing="path" signInUrl="/portal" fallbackRedirectUrl="/dashboard" appearance={portalAppearance} />
  </PortalShell>;
}

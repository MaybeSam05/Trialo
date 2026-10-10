import { SignIn } from "@clerk/nextjs";
import { PortalShell, portalAppearance } from "@/components/portal/portal-shell";

export const metadata = { title: "Sign in · Trialo" };

export default function PortalSignIn() {
  return <PortalShell title="Welcome back" lede="Sign in with your username and password to manage your screening campaigns and review sessions.">
    <SignIn path="/portal" routing="path" signUpUrl="/portal/sign-up" fallbackRedirectUrl="/dashboard" appearance={portalAppearance} />
  </PortalShell>;
}

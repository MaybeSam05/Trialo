import { SignUp } from "@clerk/nextjs";
import { PortalShell, portalAppearance } from "@/components/portal/portal-shell";

export const metadata = { title: "Create an account · Trialo" };

export default function PortalSignUp() {
  return <PortalShell title="Create a coordinator account" lede="Pick a username and password. Your campaigns and their sessions are private to your account.">
    <SignUp path="/portal/sign-up" routing="path" signInUrl="/portal" fallbackRedirectUrl="/dashboard" appearance={portalAppearance} />
  </PortalShell>;
}

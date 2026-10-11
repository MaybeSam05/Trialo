import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Trialo",
  description: "Clinical trial pre-screening",
  icons: { icon: "/ollie/logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={nunito.variable}>
    <body>
      <ClerkProvider signInUrl="/portal/sign-in" signUpUrl="/portal/sign-up" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" afterSignOutUrl="/portal">
        {children}
      </ClerkProvider>
    </body>
  </html>;
}

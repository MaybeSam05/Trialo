import { Ollie } from "@/components/ollie";
import "./portal.css";

/** Coordinator portal: Ollie and a short explainer beside Clerk's sign-in / sign-up form. */
export function PortalShell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return <main id="main" className="portal">
    <section className="portal-intro">
      <div className="portal-brand"><Ollie face="hello" size={44} /><strong>Trialo</strong><span>Coordinator portal</span></div>
      <div className="portal-copy">
        <h1>{title}</h1>
        <p>{lede}</p>
        <ul>
          <li>Each account only sees the campaigns it created.</li>
          <li>Participants never need an account; they just open your campaign link.</li>
          <li>Demo with synthetic data only.</li>
        </ul>
      </div>
      <div className="portal-ollie" aria-hidden><Ollie face="hello" size={220} /></div>
    </section>
    <section className="portal-form" aria-label="Account">{children}</section>
  </main>;
}

/** Clerk's components restyled with the app palette. */
export const portalAppearance = {
  variables: {
    colorPrimary: "var(--blue)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--muted)",
    colorBackground: "var(--card)",
    colorInput: "var(--card)",
    colorBorder: "var(--line)",
    fontFamily: "var(--font-nunito), system-ui, sans-serif",
    borderRadius: "14px",
  },
  elements: {
    card: { boxShadow: "none", border: "1.5px solid var(--line)" },
    formButtonPrimary: { fontWeight: 700, minHeight: "48px" },
    formFieldInput: { minHeight: "46px", border: "1.5px solid var(--line)", boxShadow: "none" },
  },
};

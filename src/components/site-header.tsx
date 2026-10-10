import { Ollie } from "@/components/ollie";
import Link from "next/link";

export function SiteHeader({ subtitle, links = [] }: { subtitle: string; links?: { href: string; label: string }[] }) {
  return <header className="site-header">
    <Link className="brand" href={links.length ? "/" : "#main"}>
      <span aria-hidden="true"><Ollie face="hello" size={46} /></span>
      <div><strong>Trialo</strong><span>{subtitle}</span></div>
    </Link>
    {links.length > 0 && <nav className="site-nav" aria-label="Main">
      {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
    </nav>}
  </header>;
}

export const coordinatorLinks = [
  { href: "/", label: "New link" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/studies", label: "Campaigns" },
];

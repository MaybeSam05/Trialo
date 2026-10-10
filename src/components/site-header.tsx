import { Ollie } from "@/components/ollie";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { SiteNav, type NavLink } from "@/components/site-nav";

export function SiteHeader({ subtitle, links = [] }: { subtitle: string; links?: NavLink[] }) {
  return <header className="site-header">
    <Link className="brand" href={links.length ? "/" : "#main"}>
      <span aria-hidden="true"><Ollie face="hello" size={46} /></span>
      <div><strong>Trialo</strong><span>{subtitle}</span></div>
    </Link>
    {links.length > 0 && <SiteNav links={links} />}
    {links.length > 0 && <span className="site-account"><UserButton /></span>}
  </header>;
}

export const coordinatorLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/studies", label: "Campaigns" },
  { href: "/", label: "Create campaign" },
];

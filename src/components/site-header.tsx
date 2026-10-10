import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ subtitle, links = [] }: { subtitle: string; links?: { href: string; label: string }[] }) {
  return <header className="site-header">
    <Link className="brand" href={links.length ? "/" : "#main"}>
      <Image src="/ollie/hello.webp" alt="" width={46} height={46} unoptimized priority />
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
];

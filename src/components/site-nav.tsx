"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

/**
 * Coordinator navigation. The current section is underlined and marked aria-current:
 * the link whose path is the longest prefix of the URL wins ("/dashboard/sessions/…" → Dashboard,
 * "/dashboard/studies/…" → Campaigns). "/" only matches itself.
 */
export function SiteNav({ links }: { links: NavLink[] }) {
  const path = usePathname();
  const active = links
    .filter((link) => path === link.href || (link.href !== "/" && path.startsWith(`${link.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <nav className="site-nav" aria-label="Main">
    {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.href === active ? "page" : undefined}>{link.label}</Link>)}
  </nav>;
}

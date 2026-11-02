"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/feed", label: "feed" },
  { href: "/artists", label: "artists" },
  { href: "/locations", label: "locations" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex gap-4">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`pixel text-xl transition-colors ${
              active
                ? "text-mint underline decoration-pink decoration-2 underline-offset-4"
                : "text-sage hover:text-mint"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

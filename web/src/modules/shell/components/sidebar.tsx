"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "../data";
import { isActiveRoute } from "../lib";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-bg-surface p-3">
      <p className="px-3 py-4 text-sm font-semibold">Securepass</p>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActiveRoute(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center rounded-md px-3 text-sm focus-visible:outline-2 focus-visible:outline-text-primary ${
              active ? "bg-bg-elevated font-medium text-text-primary" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

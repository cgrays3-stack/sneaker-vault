"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/collection", label: "Collection" },
  { href: "/grails", label: "Grails" },
  { href: "/add", label: "Add" },
  { href: "/wear-log", label: "Wears" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-4 mt-6 rounded-3xl bg-slate-900 p-2 text-white shadow-lg">
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl px-3 py-3 ${
                active ? "bg-white text-slate-900" : "text-white/80"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
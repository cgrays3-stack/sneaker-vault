"use client";

import Link from "next/link";
import { Home } from "lucide-react";

export function AppHeader({
  title = "Sneaker Vault",
  rightContent,
}: {
  title?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 mb-4">
      <div className="relative flex items-center justify-center rounded-3xl bg-white/80 backdrop-blur px-4 py-4 shadow-sm">
        
        {/* Left: Home button */}
        <Link
          href="/"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
        >
          <Home size={18} />
        </Link>

        {/* Center: Title */}
        <h1 className="text-lg font-semibold text-slate-900">
          {title}
        </h1>

        {/* Right: Actions */}
        {rightContent && (
          <div className="absolute right-4 flex items-center gap-2">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
}
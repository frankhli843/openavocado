"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface MeResponse {
  ok: boolean;
  user?: {
    id: number;
    username: string;
    display_name: string;
    active_learner_id: number | null;
    is_guest: boolean;
  };
}

export function GuestAccountBanner() {
  const pathname = usePathname();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MeResponse;
        if (!cancelled) setIsGuest(Boolean(data.user?.is_guest));
      } catch {
        if (!cancelled) setIsGuest(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!isGuest || pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="leading-relaxed">
          You are learning as a temporary guest. Set a username and password now so you do not lose your lessons and progress.
          Existing users can sign in instead.
        </p>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/register?claim=1"
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Set username and password
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { LearnerProfile } from "@/types";

interface ProfileSwitcherProps {
  userId: number;
  activeId: number | null;
  /** Called with the active learner id once profiles load and whenever it changes. */
  onActiveChange: (learnerId: number) => void;
}

/**
 * Profile switcher + manager. Lets the user see the active learner profile,
 * switch between profiles, create new ones, and rename / edit each profile's
 * configuration independently. All subject/progress views are scoped by the
 * active profile, so switching here re-scopes the whole dashboard.
 */
export function ProfileSwitcher({ userId, activeId, onActiveChange }: ProfileSwitcherProps) {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState<LearnerProfile | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef(false);

  async function loadProfiles(selectId?: number) {
    const res = await fetch(`/api/profiles?user_id=${userId}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      profiles: LearnerProfile[];
      active_learner_id: number | null;
    };
    setProfiles(data.profiles);
    setLoaded(true);
    const resolved = selectId ?? data.active_learner_id ?? data.profiles[0]?.id ?? null;
    if (resolved != null && (!notifiedRef.current || selectId != null)) {
      notifiedRef.current = true;
      onActiveChange(resolved);
    }
  }

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchTo(id: number) {
    setOpen(false);
    if (id === activeId) return;
    await fetch("/api/profiles/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, learner_id: id }),
    });
    onActiveChange(id);
  }

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0];
  if (!loaded) {
    return <div className="h-8 w-28 rounded-lg bg-gray-100 animate-pulse" aria-hidden />;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors max-w-[11rem]"
        title="Switch learner profile"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold">
          {(active?.display_name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate text-sm font-medium text-gray-800">
          {active?.display_name ?? "Profile"}
        </span>
        <span className="text-gray-400 text-xs">&#9662;</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Learner profiles
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {profiles.map((p) => (
              <li key={p.id}>
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                  <button onClick={() => switchTo(p.id)} className="flex flex-1 items-center gap-2 min-w-0 text-left">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                      {p.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-sm text-gray-800">{p.display_name}</span>
                    {p.id === activeId && (
                      <span className="ml-auto text-xs font-medium text-green-600 shrink-0">Active</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setOpen(false); setManage(p); }}
                    className="shrink-0 text-xs text-gray-400 hover:text-blue-600"
                    title="Edit profile"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { setOpen(false); setManage("new"); }}
            className="w-full px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 border-t border-gray-100"
          >
            + Add a profile
          </button>
        </div>
      )}

      {manage && (
        <ProfileEditModal
          userId={userId}
          profile={manage === "new" ? null : manage}
          onClose={() => setManage(null)}
          onSaved={(savedId, makeActive) => {
            setManage(null);
            loadProfiles(makeActive ? savedId : undefined);
          }}
        />
      )}
    </div>
  );
}

function ProfileEditModal({
  userId,
  profile,
  onClose,
  onSaved,
}: {
  userId: number;
  profile: LearnerProfile | null;
  onClose: () => void;
  onSaved: (id: number, makeActive: boolean) => void;
}) {
  const isNew = profile === null;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  // Config is shown/edited as readable "notes" text plus optional JSON, kept
  // privacy-safe and free-form. We store it as { notes } unless valid JSON given.
  const initialConfig = (() => {
    if (!profile?.config) return "";
    try {
      const c = JSON.parse(profile.config) as Record<string, unknown>;
      if (typeof c.notes === "string") return c.notes;
      return JSON.stringify(c, null, 2);
    } catch {
      return profile.config;
    }
  })();
  const [notes, setNotes] = useState(initialConfig);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setErr("Display name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const config = notes.trim() ? { notes: notes.trim() } : null;
      if (isNew) {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, display_name: name.trim(), bio: bio.trim() || null, config }),
        });
        if (!res.ok) throw new Error((await res.json())?.error || `HTTP ${res.status}`);
        const data = (await res.json()) as { profile: LearnerProfile };
        onSaved(data.profile.id, true);
      } else {
        const res = await fetch(`/api/profiles/${profile!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: name.trim(), bio: bio.trim() || null, config }),
        });
        if (!res.ok) throw new Error((await res.json())?.error || `HTTP ${res.status}`);
        onSaved(profile!.id, false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save profile");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4 sm:py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {isNew ? "Add a learner profile" : "Edit profile"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Short bio <span className="font-normal text-gray-400">(optional)</span></span>
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about this learner"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Learning notes &amp; preferences <span className="font-normal text-gray-400">(optional)</span></span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Context to guide lesson generation: goals, pace, style, prior background, what to avoid…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
            <span className="mt-1 block text-xs text-gray-400">Used as context for generating this profile&apos;s lessons. Kept private to local storage.</span>
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : isNew ? "Create profile" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

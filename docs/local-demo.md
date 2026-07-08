# Running the Local Demo Durably

This document describes a generic, privacy-safe pattern for keeping a local
Open Avocado instance online and current. It contains no personal data,
credentials, or host-specific deployment identifiers — those belong in local
ops notes, not in this repo.

## Goal

A local demo should not depend on a hand-started `next dev` in a terminal or
`tmux` session. That state disappears on reboot, on session cleanup, and on
crashes, and it can silently serve stale code after new commits land. Replace it
with a supervised service plus a small health/update mechanism.

## Components

1. **A supervised service** (e.g. a user-level `systemd` service, `launchd`
   agent, `pm2`, or a process supervisor) that:
   - runs from the repo working directory,
   - sets any runtime flags the platform needs (for example, Node 25 requires
     `NODE_OPTIONS=--localstorage-file=<path>` so the Next dev server's Web
     Storage polyfill has a backing file),
   - binds the demo port on `0.0.0.0` for LAN/VPN access,
   - restarts on failure with a crash-loop limit,
   - exposes logs through the platform's journal,
   - embeds no secrets.

   Two serve modes are sensible:
   - **dev** (`next dev`): no build step, compiles routes lazily, and stays up
     even when the tree has work-in-progress or a single broken route. Good
     default for a single-user local demo.
   - **prod** (`next build` + `next start`): lighter runtime, but a build is
     all-or-nothing, so only restart after a green build.

2. **A safe update/start script** run as a preflight or on demand that:
   - `git fetch` (read-only) and compares local `HEAD` to `origin/main`,
   - refuses to touch a **dirty** working tree (never discards local work),
   - updates only on a true **fast-forward**; refuses a diverged branch instead
     of resetting,
   - runs `pnpm install` only when `package.json`/`pnpm-lock.yaml` changed,
   - runs the **non-destructive** migration (`pnpm db:migrate`, no `--seed`) so
     existing runtime data is preserved,
   - rebuilds in prod mode before restarting,
   - restarts the service and verifies HTTP + API before declaring success,
   - never commits, pushes, or publishes runtime data (SQLite DBs, generated
     audio, learner answers, and local config are all gitignored).

3. **A health check** that probes service status, HTTP reachability, API sanity
   (`/api/subjects?learner_id=<id>` returns subjects), and commit freshness, and
   attempts the safe repair path (start → restart → safe fast-forward update →
   verify) before alerting. It should fail loudly with the exact failing phase
   when repair is unsafe (dirty tree behind origin, diverged branch, failing
   build/migrate/restart) and never silently serve stale code.

## First run

The demo creates and seeds a local SQLite database on first start when none
exists (`pnpm db:migrate -- --seed` produces synthetic, non-personal demo data).
Subsequent runs migrate only, preserving accumulated runtime state.

## Verifying

```bash
curl -sf http://127.0.0.1:<port>/ -o /dev/null && echo "home OK"
curl -s  "http://127.0.0.1:<port>/api/subjects?learner_id=1" | head -c 200
```

A healthy demo returns HTTP 200 on the home page and a non-empty `subjects`
array from the API.

## Reseeding

Reseeding is **opt-in only**. The default update path never reseeds, because
that would discard the learner's accumulated progress. Seed explicitly
(`pnpm db:migrate -- --seed`) only when intentionally resetting a throwaway demo
to synthetic data.

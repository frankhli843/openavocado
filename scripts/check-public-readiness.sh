#!/usr/bin/env bash
#
# Open Avocado — public-readiness audit.
#
# FAILS (exit 1) when a public-facing surface leaks a private brand/name, when a
# hard secret is tracked in git, or when a public surface still says "AvocadoCore"
# instead of "Open Avocado". WARNS (no failure) on documented internal-compat
# tokens in non-public code (scripts/, tests, internal library prompt strings).
#
# Public surfaces (must be 100% clean):
#   README.md, .env.example, package.json, docs/, site/, src/app/ UI
#
# Documented internal-compat tokens intentionally retained (see docs + task notes):
#   - AVOCADOCORE_* environment variable names (set by existing deployments)
#   - avocadocore.db (SQLite filename) and skills/avocadocore-lesson-authoring (skill path)
#   - dora-task adapter enum + doraemon-edge-tts TtsProvider enum (DB-persisted, user-hidden)
#   - "Doraemon" transcript speaker label in the podcast-parsing regex
#
# Usage: bash scripts/check-public-readiness.sh
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

say()  { printf '%s\n' "$*"; }
err()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; fail=1; }
ok()   { printf '  \033[32mok\033[0m   %s\n' "$*"; }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$*"; }

# ── 1. Hard secrets must never be tracked anywhere ───────────────────────────
say "[1] Hard-secret scan (all tracked files)"
SECRET_RE='sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
# Test files legitimately contain obviously-synthetic key-shape fixtures; exclude them.
hits=$(git grep -InE "$SECRET_RE" -- ':!pnpm-lock.yaml' ':!scripts/check-public-readiness.sh' \
  ':!*.test.ts' ':!*.test.tsx' ':!*.spec.ts' ':!*/__tests__/*' 2>/dev/null)
if [ -n "$hits" ]; then err "tracked secret-like strings:"; printf '%s\n' "$hits"; else ok "no tracked secrets"; fi
# Private / tailnet IP anywhere in tracked files (Tailscale CGNAT 100.64/10 + known hosts).
TAILNET_RE='\b100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.[0-9]+\.[0-9]+\b|\b(178\.105\.119|89\.167\.21)\.[0-9]+\b'
tn=$(git grep -InE "$TAILNET_RE" -- ':!pnpm-lock.yaml' ':!scripts/check-public-readiness.sh' 2>/dev/null)
if [ -n "$tn" ]; then err "private/tailnet IP in tracked files:"; printf '%s\n' "$tn"; else ok "no private/tailnet IPs tracked"; fi

# ── 2. Public surfaces must not leak private brands/names ─────────────────────
say "[2] Private-leakage scan (public surfaces)"
PUBLIC_PATHS=(README.md .env.example package.json docs site 'src/app')
# Forbidden in public surfaces. NOTE: OpenClaw / Gemmaclaw / Hermes are allowed —
# they are documented, optional lesson-generation runtimes, not leakage.
FORBIDDEN='Doraemon|Doramon|frankclaw|prodavo|frankavo|devavo|frank-dev|frankhli843/avocadocore|George VPS'
# Case-sensitive product-name check (AVOCADOCORE_ env vars and avocadocore.db are lowercase/upper, not this).
for p in "${PUBLIC_PATHS[@]}"; do
  [ -e "$p" ] || continue
  h=$(git grep -InE "$FORBIDDEN" -- "$p" 2>/dev/null)
  [ -n "$h" ] && { err "private token in $p:"; printf '%s\n' "$h"; }
  b=$(git grep -In 'AvocadoCore' -- "$p" 2>/dev/null)
  [ -n "$b" ] && { err "old brand 'AvocadoCore' in $p (use 'Open Avocado'):"; printf '%s\n' "$b"; }
done
# Private IP / tailnet / raw nip.io host leakage in public surfaces
IP_RE='\b(178\.105\.119|89\.167\.21)\.[0-9]+\b|\b100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9])\.[0-9]+\.[0-9]+\b'
for p in "${PUBLIC_PATHS[@]}"; do
  [ -e "$p" ] || continue
  h=$(git grep -InE "$IP_RE" -- "$p" 2>/dev/null)
  [ -n "$h" ] && { err "private IP in $p:"; printf '%s\n' "$h"; }
done
[ "$fail" -eq 0 ] && ok "public surfaces clean of private brands, old brand name, and private IPs"

# ── 3. Runtime data / secrets must not be tracked ────────────────────────────
say "[3] Tracked-artifact scan (runtime data must be gitignored)"
bad=$(git ls-files | grep -Ei '\.(db|sqlite|sqlite3)$|\.env($|\.)|(^|/)runtime_artifacts/|\.mp3$|\.wav$|(^|/)data/.*\.(db|json)$' | grep -v '\.env\.example$' || true)
if [ -n "$bad" ]; then err "runtime/secret artifacts tracked:"; printf '%s\n' "$bad"; else ok "no runtime DBs / audio / .env tracked"; fi

# ── 4. Documented internal-compat tokens (informational only) ────────────────
say "[4] Internal-compat tokens (documented, non-blocking)"
int=$(git grep -Il -E 'Doraemon|Doramon|prodavo|frankavo|frankclaw|\bFrank\b' -- 'scripts' 'src/lib' 'src/test' 'src/types' 2>/dev/null | wc -l)
warn "$int internal file(s) reference retained/legacy tokens (scripts/, src/lib prompt strings, tests)."
warn "scripts/ one-off authoring tooling is NOT published-ready; prune or relocate before making the repo public."

echo
if [ "$fail" -ne 0 ]; then
  say "PUBLIC-READINESS: FAIL — fix the items above before publishing."
  exit 1
fi
say "PUBLIC-READINESS: PASS — public surfaces are clean. See [4] for pre-publication follow-ups."

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0

section() {
  printf '\n== %s ==\n' "$1"
}

run_check() {
  local name="$1"
  shift
  section "$name"
  if "$@"; then
    echo "OK"
  else
    fail=1
  fi
}

check_private_words() {
  local pattern
  pattern='(/home/frank|\.openclaw|OPENCLAW_WORKSPACE|frankclaw|prodavo|frankavo|[Dd]oramon|[Dd]oraemon|doreamon|DaHong|Charlotte|Yiting|George|Sara|lifrank|wsfccorp|peoplefree|178\.105\.|89\.167\.|100\.[0-9]{1,3}\.|nip\.io)'
  if git grep -IEn "$pattern" -- . \
    ':!scripts/check-public-readiness.sh' \
    ':!docs/agent-task-harness.md' \
    ':!src/lib/adapters/dora-task.ts'; then
    echo "FAIL: private or deployment-specific words found in tracked files."
    return 1
  fi
}

check_runtime_artifacts() {
  local matches
  matches="$(git ls-files | grep -v '^site/' | grep -E '(^|/)(state|data|runtime_artifacts|uploads|exports|artifacts)/|\.db$|\.sqlite3?$|\.mp3$|\.wav$|\.ogg$|\.m4a$|\.mp4$' || true)"
  if [[ -n "$matches" ]]; then
    echo "$matches"
    echo "FAIL: tracked runtime artifacts or local data files found."
    return 1
  fi
}

check_private_scripts() {
  local matches
  matches="$(git ls-files scripts | grep -E 'scripts/(active-learning-section85|algo-artifacts/|gemma-artifacts/|create-lesson-gemma|create-algo-|import-algo-repo-history|insert-lesson5|validate-lesson9|_validate-lesson25|backfill-lesson[0-9]|backfill-transformer|backfill-remaining-diagrams|prodavo-deploy\\.sh)' || true)"
  if [[ -n "$matches" ]]; then
    echo "$matches"
    echo "FAIL: private one-off backfill or import scripts are tracked."
    return 1
  fi
}

check_secret_assignments() {
  local matches
  matches="$(git grep -IEn '(OPENAI_API_KEY|GOOGLE_AI_STUDIO_API_KEY|ANTHROPIC_API_KEY|SESSION_SECRET|JWT_SECRET|AUTH_SECRET)=["'\'']?[A-Za-z0-9_./:+-]{12,}' -- . ':!.env.example' || true)"
  if [[ -n "$matches" ]]; then
    echo "$matches"
    echo "FAIL: possible committed secret assignment found."
    return 1
  fi
}

check_old_badges() {
  if git grep -IEn 'Powered by Gemma|Gemma 4|Gemma-4|gemma-4' -- . ':!scripts/check-public-readiness.sh'; then
    echo "FAIL: specific model branding or demo-specific model text found."
    return 1
  fi
}

run_check "private words" check_private_words
run_check "runtime artifacts" check_runtime_artifacts
run_check "private scripts" check_private_scripts
run_check "secret assignments" check_secret_assignments
run_check "model branding" check_old_badges

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Public readiness check failed."
  exit 1
fi

echo
echo "Public readiness check passed."

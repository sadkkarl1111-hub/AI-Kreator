#!/usr/bin/env sh
set -eu

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kreator-ai-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kreator_ai}"
POSTGRES_USER="${POSTGRES_USER:-app_user}"
TEST_USER_ID="generation-job-limit-test-$(date -u +%Y%m%dT%H%M%SZ)-$$"
LIMIT=2
ATTEMPTS=10

run_psql() {
  docker exec "$POSTGRES_CONTAINER" sh -lc \
    "export PGPASSWORD=\"\$POSTGRES_PASSWORD\"; psql -h 127.0.0.1 -U '$POSTGRES_USER' -d '$POSTGRES_DB' -t -A -c \"$1\""
}

cleanup() {
  run_psql "DELETE FROM generation_jobs WHERE user_id = '$TEST_USER_ID';" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

run_psql "CREATE TABLE IF NOT EXISTS generation_jobs (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id TEXT NOT NULL, job_type TEXT NOT NULL DEFAULT 'generation', status TEXT NOT NULL DEFAULT 'running', cost INTEGER NOT NULL DEFAULT 0, model TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ NULL);" >/dev/null

tmp_dir="/tmp/ai-kreator-generation-jobs-$$"
mkdir -p "$tmp_dir"

i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  (
    result="$(run_psql "BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('$TEST_USER_ID', 0)); WITH active AS (SELECT COUNT(*)::int AS count FROM generation_jobs WHERE user_id = '$TEST_USER_ID' AND status = 'running'), inserted AS (INSERT INTO generation_jobs (user_id, job_type, status, cost, model) SELECT '$TEST_USER_ID', 'generate-image', 'running', 30, 'test' FROM active WHERE active.count < $LIMIT RETURNING id) SELECT COUNT(*) FROM inserted; COMMIT;" | grep -E '^[0-9]+$' | tail -n 1 || true)"
    if [ "$result" = "1" ]; then
      echo "1" > "$tmp_dir/$i.ok"
    else
      echo "0" > "$tmp_dir/$i.ok"
    fi
  ) &
  i=$((i + 1))
done

wait

success_count=0
for file in "$tmp_dir"/*.ok; do
  value="$(cat "$file")"
  if [ "$value" = "1" ]; then
    success_count=$((success_count + 1))
  fi
done

active_count="$(run_psql "SELECT COUNT(*) FROM generation_jobs WHERE user_id = '$TEST_USER_ID' AND status = 'running';" | tr -d '[:space:]')"
rm -rf "$tmp_dir"

if [ "$success_count" -ne "$LIMIT" ] || [ "$active_count" -ne "$LIMIT" ]; then
  echo "[generation-job-limit] FAILED: successes=$success_count expected=$LIMIT, active=$active_count expected=$LIMIT" >&2
  exit 1
fi

echo "[generation-job-limit] ok: successes=$success_count, active=$active_count"

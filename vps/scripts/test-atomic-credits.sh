#!/usr/bin/env sh
set -eu

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kreator-ai-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kreator_ai}"
POSTGRES_USER="${POSTGRES_USER:-app_user}"
TEST_USER_ID="atomic-credit-test-$(date -u +%Y%m%dT%H%M%SZ)-$$"
START_BALANCE=100
COST=30
ATTEMPTS=10
EXPECTED_SUCCESS=3
EXPECTED_BALANCE=10

run_psql() {
  docker exec "$POSTGRES_CONTAINER" sh -lc \
    "export PGPASSWORD=\"\$POSTGRES_PASSWORD\"; psql -h 127.0.0.1 -U '$POSTGRES_USER' -d '$POSTGRES_DB' -t -A -c \"$1\""
}

cleanup() {
  run_psql "DELETE FROM user_credits WHERE user_id = '$TEST_USER_ID';" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

run_psql "INSERT INTO user_credits (user_id, balance) VALUES ('$TEST_USER_ID', $START_BALANCE) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();" >/dev/null

success_count=0
tmp_dir="/tmp/ai-kreator-atomic-credits-$$"
mkdir -p "$tmp_dir"

i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  (
    result="$(run_psql "UPDATE user_credits SET balance = balance - $COST, updated_at = now() WHERE user_id = '$TEST_USER_ID' AND balance >= $COST RETURNING balance;" | grep -E '^[0-9]+$' | tail -n 1 || true)"
    if [ -n "$result" ]; then
      echo "1" > "$tmp_dir/$i.ok"
    else
      echo "0" > "$tmp_dir/$i.ok"
    fi
  ) &
  i=$((i + 1))
done

wait

for file in "$tmp_dir"/*.ok; do
  value="$(cat "$file")"
  if [ "$value" = "1" ]; then
    success_count=$((success_count + 1))
  fi
done

final_balance="$(run_psql "SELECT balance FROM user_credits WHERE user_id = '$TEST_USER_ID' LIMIT 1;" | tr -d '[:space:]')"
rm -rf "$tmp_dir"

if [ "$success_count" -ne "$EXPECTED_SUCCESS" ] || [ "$final_balance" -ne "$EXPECTED_BALANCE" ]; then
  echo "[atomic-credits] FAILED: successes=$success_count expected=$EXPECTED_SUCCESS, balance=$final_balance expected=$EXPECTED_BALANCE" >&2
  exit 1
fi

echo "[atomic-credits] ok: successes=$success_count, balance=$final_balance"

#!/usr/bin/env bash
# smoke-auth.sh — end-to-end test of the registration + email verification flow.
# Requires: API running (pnpm dev), Docker services running (pnpm db).
# Usage: pnpm smoke:auth [API_URL] [MAILPIT_URL]

set -euo pipefail

API_URL="${1:-http://localhost:3000}"
MAILPIT_URL="${2:-http://localhost:8025}"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="Smoke1test"
NAME="Smoke Test User"

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
fail() { echo -e "${RED}✘${RESET}  $*"; exit 1; }
info() { echo -e "${CYAN}→${RESET}  $*"; }

echo ""
info "API:     $API_URL"
info "Mailpit: $MAILPIT_URL"
info "Email:   $EMAIL"
echo ""

# ── 1. Register ───────────────────────────────────────────────────────────────
info "POST /auth/register"
REGISTER=$(curl -sf -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"confirmPassword\":\"$PASSWORD\"}" \
  2>/dev/null) || fail "Registration request failed — is the API running at $API_URL?"

MESSAGE=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
[[ "$MESSAGE" == *"inbox"* ]] || fail "Unexpected register response: $REGISTER"
ok "Account created — $MESSAGE"

# ── 2. Poll Mailpit for the verification token ────────────────────────────────
info "Polling Mailpit for verification email…"
TOKEN=""
for i in $(seq 1 10); do
  sleep 1
  MSGS=$(curl -sf "$MAILPIT_URL/api/v1/messages" 2>/dev/null) || continue
  MSG_ID=$(echo "$MSGS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('messages', []):
    for t in m.get('To', []):
        if t.get('Address') == '$EMAIL':
            print(m['ID'])
            break
" 2>/dev/null)
  if [[ -n "$MSG_ID" ]]; then
    BODY=$(curl -sf "$MAILPIT_URL/api/v1/message/$MSG_ID" 2>/dev/null)
    TOKEN=$(echo "$BODY" | python3 -c "
import sys, re
content = sys.stdin.read()
m = re.search(r'token=([a-f0-9-]{36})', content)
if m: print(m.group(1))
" 2>/dev/null)
    [[ -n "$TOKEN" ]] && break
  fi
done

[[ -n "$TOKEN" ]] || fail "Verification token not found in Mailpit after 10 seconds — is Mailpit running at $MAILPIT_URL?"
ok "Verification token received: $TOKEN"

# ── 3. Verify email ───────────────────────────────────────────────────────────
info "GET /auth/verify-email?token=…"
VERIFY=$(curl -sf -c /tmp/smoke-auth-cookies.txt \
  "$API_URL/auth/verify-email?token=$TOKEN" 2>/dev/null) \
  || fail "Verify request failed"

ACCESS_TOKEN=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
USER_ID=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null)
ROLE=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('role',''))" 2>/dev/null)

[[ -n "$ACCESS_TOKEN" ]] || fail "No access token in verify response: $VERIFY"
ok "Email verified — user signed in"
ok "User ID:       $USER_ID"
ok "Role:          $ROLE"
ok "Access token:  ${ACCESS_TOKEN:0:40}…"

# ── 4. Confirm refresh cookie ─────────────────────────────────────────────────
grep -q "refreshToken" /tmp/smoke-auth-cookies.txt \
  && ok "Refresh cookie set (HttpOnly)" \
  || fail "Refresh cookie missing"

# ── 5. Confirm token is single-use ───────────────────────────────────────────
info "Confirming token is single-use…"
REUSE=$(curl -s "$API_URL/auth/verify-email?token=$TOKEN" 2>/dev/null || true)
ERROR=$(echo "$REUSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
[[ "$ERROR" == *"Invalid"* ]] \
  && ok "Token rejected on reuse (single-use confirmed)" \
  || fail "Token was accepted a second time — single-use not enforced"

echo ""
ok "All checks passed."
echo ""

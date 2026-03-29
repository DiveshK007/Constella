#!/bin/bash
# StellrFlow Deep API Test Suite
BASE="http://localhost:3003"
OUT="/Users/bond/StellrFlow/test-results.txt"
PASS=0
FAIL=0

test_api() {
  local label="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expect="$5"
  
  if [ "$method" = "GET" ]; then
    RESP=$(curl -s "$url" 2>&1)
  elif [ "$method" = "DELETE" ]; then
    RESP=$(curl -s -X DELETE "$url" 2>&1)
  else
    RESP=$(curl -s -X POST "$url" -H 'Content-Type: application/json' -d "$data" 2>&1)
  fi
  
  if echo "$RESP" | grep -q "$expect"; then
    echo "✅ $label" >> $OUT
    echo "   Response: $RESP" >> $OUT
    PASS=$((PASS+1))
  else
    echo "❌ $label" >> $OUT
    echo "   Expected: $expect" >> $OUT
    echo "   Got: $RESP" >> $OUT
    FAIL=$((FAIL+1))
  fi
  echo "" >> $OUT
}

echo "========================================" > $OUT
echo " StellrFlow Deep Analysis Test Report" >> $OUT
echo " $(date)" >> $OUT
echo "========================================" >> $OUT
echo "" >> $OUT

# ── SECTION 1: Health & Status ──
echo "── 1. HEALTH & STATUS ──" >> $OUT
test_api "Health endpoint" GET "$BASE/api/telegram/health" "" '"status":"ok"'

# ── SECTION 2: Anchor - Exchange Rates ──
echo "── 2. ANCHOR - EXCHANGE RATES ──" >> $OUT
test_api "Get all rates" GET "$BASE/api/anchor/rates" "" '"success":true'
test_api "Rates contain USD" GET "$BASE/api/anchor/rates" "" '"currency":"USD"'
test_api "Rates contain EUR" GET "$BASE/api/anchor/rates" "" '"currency":"EUR"'
test_api "Rates contain INR" GET "$BASE/api/anchor/rates" "" '"currency":"INR"'
test_api "Rates contain GBP" GET "$BASE/api/anchor/rates" "" '"currency":"GBP"'

# ── SECTION 3: Wallet Creation ──
echo "── 3. WALLET MANAGEMENT ──" >> $OUT
test_api "Create wallet (user A)" POST "$BASE/api/wallet/create" '{"chatId":"userA"}' '"success":true'
test_api "Create wallet (user B)" POST "$BASE/api/wallet/create" '{"chatId":"userB"}' '"success":true'
test_api "Get wallet A" GET "$BASE/api/wallet/userA" "" '"success":true'
test_api "Get wallet B" GET "$BASE/api/wallet/userB" "" '"success":true'
test_api "Get nonexistent wallet" GET "$BASE/api/wallet/nobody" "" '"success":false'

# ── SECTION 4: Wallet Balance ──
echo "── 4. WALLET BALANCE ──" >> $OUT
test_api "Balance user A" GET "$BASE/api/wallet/userA/balance" "" 'balance'

# ── SECTION 5: Wallet Funding (Friendbot) ──
echo "── 5. WALLET FUNDING (Friendbot) ──" >> $OUT
test_api "Fund wallet A via Friendbot" POST "$BASE/api/wallet/userA/fund" '{}' 'success'

# ── SECTION 6: Anchor Deposit (On-Ramp) ──
echo "── 6. ANCHOR DEPOSIT (On-Ramp) ──" >> $OUT
test_api "Deposit 50 USD for userA" POST "$BASE/api/anchor/deposit" '{"chatId":"userA","amount":"50","currency":"USD"}' '"success":true'
test_api "Deposit 100 EUR for userA" POST "$BASE/api/anchor/deposit" '{"chatId":"userA","amount":"100","currency":"EUR"}' '"success":true'
test_api "Deposit missing params" POST "$BASE/api/anchor/deposit" '{"chatId":"userA"}' 'amount'

# ── SECTION 7: Anchor Withdraw (Off-Ramp) ──
echo "── 7. ANCHOR WITHDRAW (Off-Ramp) ──" >> $OUT
test_api "Withdraw 10 XLM for userA" POST "$BASE/api/anchor/withdraw" '{"chatId":"userA","xlmAmount":"10","currency":"USD"}' 'success'
test_api "Withdraw missing params" POST "$BASE/api/anchor/withdraw" '{"chatId":"userA"}' 'xlmAmount'

# ── SECTION 8: Anchor History ──
echo "── 8. ANCHOR HISTORY ──" >> $OUT
test_api "Tx history for userA" GET "$BASE/api/anchor/history/userA" "" 'success'

# ── SECTION 9: Send XLM between wallets ──
echo "── 9. SEND XLM ──" >> $OUT
# Get userB public key first
USERB_PK=$(curl -s "$BASE/api/wallet/userB" | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4)
echo "   UserB pubkey: $USERB_PK" >> $OUT
if [ -n "$USERB_PK" ]; then
  test_api "Send 5 XLM from userA to userB" POST "$BASE/api/wallet/userA/send" "{\"destination\":\"$USERB_PK\",\"amount\":\"5\"}" 'success'
else
  echo "❌ Could not get userB public key" >> $OUT
  FAIL=$((FAIL+1))
fi

# ── SECTION 10: Session Management ──
echo "── 10. SESSION MANAGEMENT ──" >> $OUT
test_api "Register session" POST "$BASE/api/session/register" '{"chatId":"sessUser","features":["balance","send"]}' 'success'
test_api "Get session" GET "$BASE/api/session/sessUser" "" 'sessUser'
test_api "Delete session" DELETE "$BASE/api/session/sessUser" "" 'success'

# ── SECTION 11: Freighter Wallet ──
echo "── 11. FREIGHTER WALLET ──" >> $OUT
test_api "Connect Freighter" POST "$BASE/api/freighter/connect" '{"chatId":"freightUser","publicKey":"GBZXN7PIRZGNMHGA7MUUUF4GWJTNBCYPH7PMRL4X6JNPUFWGQ5VCAAH"}' 'success'
test_api "Get Freighter wallet" GET "$BASE/api/freighter/freightUser" "" 'publicKey'
test_api "Disconnect Freighter" DELETE "$BASE/api/freighter/freightUser" "" 'success'

# ── SECTION 12: AutoPay ──
echo "── 12. AUTOPAY ──" >> $OUT
test_api "Create autopay schedule" POST "$BASE/api/autopay/create" "{\"chatId\":\"userA\",\"destination\":\"$USERB_PK\",\"amount\":\"1\",\"interval\":\"daily\"}" 'success'
test_api "List autopay for userA" GET "$BASE/api/autopay/userA" "" 'success'

# ── SECTION 13: Multisig ──
echo "── 13. MULTISIG ──" >> $OUT
test_api "Create multisig tx" POST "$BASE/api/multisig/create" "{\"chatId\":\"userA\",\"signers\":[\"$USERB_PK\"],\"threshold\":2,\"destination\":\"$USERB_PK\",\"amount\":\"5\"}" 'success'
test_api "List multisig for userA" GET "$BASE/api/multisig/userA" "" 'success'

# ── SECTION 14: Transaction Build/Submit ──
echo "── 14. TRANSACTION BUILD ──" >> $OUT
test_api "Build tx (missing params)" POST "$BASE/api/transaction/build" '{"sourcePublicKey":"GABC"}' 'error'

# ── SECTION 15: Stellar Balance by Address ──
echo "── 15. STELLAR BALANCE BY ADDRESS ──" >> $OUT
USERA_PK=$(curl -s "$BASE/api/wallet/userA" | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4)
test_api "Stellar balance for userA address" GET "$BASE/api/stellar/balance/$USERA_PK" "" 'balance'

# ── SECTION 16: Edge Cases ──
echo "── 16. EDGE CASES ──" >> $OUT
test_api "Invalid endpoint returns 404" GET "$BASE/api/nonexistent" "" '404\|Cannot GET'
test_api "Deposit with 0 amount" POST "$BASE/api/anchor/deposit" '{"chatId":"userA","amount":"0","currency":"USD"}' 'error\|amount'
test_api "Withdraw more than balance" POST "$BASE/api/anchor/withdraw" '{"chatId":"userA","xlmAmount":"999999","currency":"USD"}' 'error\|insufficient\|Insufficient\|not enough\|fail'

# ── SUMMARY ──
echo "========================================" >> $OUT
echo " SUMMARY: $PASS passed, $FAIL failed" >> $OUT
echo "========================================" >> $OUT

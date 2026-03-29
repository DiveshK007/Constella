#!/bin/bash
echo "============================================"
echo "  StellrFlow Full API Test Suite"
echo "============================================"
echo ""

BASE="http://localhost:3003"
CHAT_ID="test_$(date +%s)"

# 1. Health check
echo "1. Health Check"
curl -s "$BASE/api/telegram/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/telegram/health"
echo ""
echo ""

# 2. Anchor Rates
echo "2. Anchor Rates"
curl -s "$BASE/api/anchor/rates" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/anchor/rates"
echo ""
echo ""

# 3. Create Wallet
echo "3. Create Wallet (chatId: $CHAT_ID)"
WALLET_RESULT=$(curl -s -X POST "$BASE/api/wallet/create" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\"}")
echo "$WALLET_RESULT" | python3 -m json.tool 2>/dev/null || echo "$WALLET_RESULT"
PUBLIC_KEY=$(echo "$WALLET_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['publicKey'])" 2>/dev/null)
echo "Public Key: $PUBLIC_KEY"
echo ""

# 4. Get Wallet
echo "4. Get Wallet Info"
curl -s "$BASE/api/wallet/$CHAT_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/wallet/$CHAT_ID"
echo ""
echo ""

# 5. Get Wallet Balance (unfunded)
echo "5. Get Wallet Balance (unfunded)"
curl -s "$BASE/api/wallet/$CHAT_ID/balance" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/wallet/$CHAT_ID/balance"
echo ""
echo ""

# 6. Fund Wallet (Friendbot)
echo "6. Fund Wallet via Friendbot"
curl -s -X POST "$BASE/api/wallet/$CHAT_ID/fund" | python3 -m json.tool 2>/dev/null || curl -s -X POST "$BASE/api/wallet/$CHAT_ID/fund"
echo ""
echo ""

# 7. Get Balance (after funding)
echo "7. Get Wallet Balance (after funding)"
curl -s "$BASE/api/wallet/$CHAT_ID/balance" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/wallet/$CHAT_ID/balance"
echo ""
echo ""

# 8. Anchor Deposit (on-ramp)
echo "8. Anchor Deposit (100 USD)"
curl -s -X POST "$BASE/api/anchor/deposit" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\",\"amount\":100,\"currency\":\"USD\"}"
echo ""
echo ""

# 9. Anchor Withdraw (off-ramp)
echo "9. Anchor Withdraw (5 XLM)"
curl -s -X POST "$BASE/api/anchor/withdraw" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\",\"xlmAmount\":5,\"currency\":\"USD\"}"
echo ""
echo ""

# 10. Anchor History
echo "10. Anchor History"
curl -s "$BASE/api/anchor/history/$CHAT_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/anchor/history/$CHAT_ID"
echo ""
echo ""

# 11. AutoPay Create
echo "11. AutoPay Create"
curl -s -X POST "$BASE/api/autopay/create" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\",\"destination\":\"GABC1234567890\",\"amount\":10,\"interval\":\"daily\",\"duration\":30}"
echo ""
echo ""

# 12. AutoPay List
echo "12. AutoPay List"
curl -s "$BASE/api/autopay/$CHAT_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/autopay/$CHAT_ID"
echo ""
echo ""

# 13. Multisig Create
echo "13. Multisig Create"
curl -s -X POST "$BASE/api/multisig/create" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\",\"threshold\":2,\"signers\":[\"signer1\",\"signer2\",\"signer3\"],\"timeout\":24}"
echo ""
echo ""

# 14. Multisig List
echo "14. Multisig List"
curl -s "$BASE/api/multisig/$CHAT_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/multisig/$CHAT_ID"
echo ""
echo ""

# 15. Session Register
echo "15. Session Register"
curl -s -X POST "$BASE/api/session/register" -H "Content-Type: application/json" -d "{\"chatId\":\"$CHAT_ID\",\"features\":[\"chatbot\",\"payments\"]}"
echo ""
echo ""

# 16. Session Get
echo "16. Session Get"
curl -s "$BASE/api/session/$CHAT_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/api/session/$CHAT_ID"
echo ""
echo ""

# 17. Frontend check
echo "17. Frontend (port 3000)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then echo "✅ Frontend OK"; else echo "❌ Frontend FAIL"; fi
echo ""

echo "============================================"
echo "  TEST SUITE COMPLETE"
echo "============================================"

#!/bin/bash
OUT="/Users/bond/StellrFlow/test-results.txt"
echo "=== StellrFlow API Test Results ===" > $OUT
echo "Date: $(date)" >> $OUT
echo "" >> $OUT

echo "1. Health Check" >> $OUT
curl -s http://localhost:3003/api/telegram/health >> $OUT
echo -e "\n" >> $OUT

echo "2. Anchor Rates" >> $OUT
curl -s http://localhost:3003/api/anchor/rates >> $OUT
echo -e "\n" >> $OUT

echo "3. Frontend" >> $OUT
curl -s -o /dev/null -w "HTTP Status: %{http_code}" http://localhost:3000 >> $OUT
echo -e "\n" >> $OUT

echo "4. Deposit (no wallet - expect error)" >> $OUT
curl -s -X POST http://localhost:3003/api/anchor/deposit -H 'Content-Type: application/json' -d '{"chatId":"99999","amount":"100","currency":"USD"}' >> $OUT
echo -e "\n" >> $OUT

echo "5. Withdraw (no wallet - expect error)" >> $OUT
curl -s -X POST http://localhost:3003/api/anchor/withdraw -H 'Content-Type: application/json' -d '{"chatId":"99999","xlmAmount":"50","currency":"USD"}' >> $OUT
echo -e "\n" >> $OUT

echo "6. Create Wallet" >> $OUT
curl -s -X POST http://localhost:3003/api/wallet/create -H 'Content-Type: application/json' -d '{"chatId":"test123"}' >> $OUT
echo -e "\n" >> $OUT

echo "7. Get Wallet" >> $OUT
curl -s http://localhost:3003/api/wallet/test123 >> $OUT
echo -e "\n" >> $OUT

echo "8. AutoPay (no wallet - expect error)" >> $OUT
curl -s -X POST http://localhost:3003/api/autopay/create -H 'Content-Type: application/json' -d '{"chatId":"99999","destination":"GABC","amount":"10","interval":"daily"}' >> $OUT
echo -e "\n" >> $OUT

echo "9. Multisig (no wallet - expect error)" >> $OUT
curl -s -X POST http://localhost:3003/api/multisig/create -H 'Content-Type: application/json' -d '{"chatId":"99999","signers":["GABC"],"threshold":2}' >> $OUT
echo -e "\n" >> $OUT

echo "=== ALL TESTS COMPLETE ===" >> $OUT

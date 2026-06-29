# StellrFlow Ecosystem Integration Guide

Welcome to the StellrFlow Ecosystem Integration Guide! StellrFlow isn't just a standalone Telegram bot and dashboard; it's a powerful notification and transaction engine that other Stellar ecosystem projects can leverage to enhance their own user experiences.

## Why Integrate with StellrFlow?
- **Instant Notifications:** Keep your users informed about their on-chain activity without building your own push notification infrastructure.
- **Seamless Onboarding:** Leverage our Telegram-based one-click wallet creation to onboard users to your dApp instantly.
- **Workflow Automation:** Use StellrFlow's drag-and-drop workflow builder (coming soon) to trigger actions based on events in your smart contracts.

## Integration Methods

### 1. Webhook Notifications API (Send Telegram Messages)
If your dApp (e.g., a DEX, NFT marketplace, or DAO) wants to send a Telegram notification to a user when an event occurs, you can use our `/api/telegram/send` endpoint.

**Endpoint:** `POST https://stellrflow.yourdomain.com/api/telegram/send`

**Headers:**
```http
Content-Type: application/json
```

**Payload:**
```json
{
  "chatId": "USER_TELEGRAM_CHAT_ID",
  "message": "🎉 <b>Trade Executed!</b>\n\nYour limit order for 100 USDC has been filled on the Stellar DEX.",
  "parseMode": "HTML"
}
```
*Note: You must ask the user for their StellrFlow Chat ID (which they can retrieve by messaging `/register` to the StellrFlow bot).*

### 2. Connect Freighter Wallet to Telegram
You can easily link a user's Freighter extension to their StellrFlow Telegram bot to allow for unified analytics and notifications.

1. Direct the user to your frontend application.
2. In your application, call our connect endpoint or direct them to:
   `https://stellrflow.yourdomain.com/connect-wallet?chatId={CHAT_ID}&network=mainnet`
3. StellrFlow handles the rest, linking their Freighter public key to their Telegram account.

### 3. Smart Contract Event Listening (Soroban)
If you are building a Soroban smart contract and want StellrFlow to monitor specific events (e.g., token transfers, contract state changes), you can register your contract address with StellrFlow.

Currently, this is a manual process. Please contact the StellrFlow team to add your Soroban contract to our indexer whitelist. Once indexed, your users can subscribe to notifications for your specific contract using:
`/watchcontract C...CONTRACT_ADDRESS` (Coming in v2)

## Support & Contact
If you are an ecosystem builder and want to partner on a tighter integration, reach out to us!
- **Twitter:** [@DIVZZZ007](https://twitter.com/DIVZZZ007)
- **GitHub:** Submit an issue on this repository.

Happy building on Stellar! 🚀

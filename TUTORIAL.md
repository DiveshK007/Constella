# Building Gasless Workflows on Stellar with Soroban and Fee Sponsorship

Welcome to this technical tutorial for the Stellar ecosystem! In this guide, we'll cover how to implement **Fee Sponsorship** (gasless transactions) in your Stellar applications using the Stellar SDK and Soroban smart contracts.

## 1. Introduction to Fee Sponsorship

In traditional blockchain networks, onboarding new users is difficult because they need native tokens (like XLM or ETH) just to pay for transaction fees (gas). 

Stellar solves this elegantly with **Fee Bump Transactions**. A fee bump transaction allows a sponsor account to pay the base fee for an inner transaction without needing to sign the inner transaction's operations. This means your users can sign transactions with zero XLM in their wallet, and your application's treasury pays the fee.

## 2. Prerequisites

- A Stellar mainnet or testnet account with XLM (the Sponsor)
- `@stellar/stellar-sdk` installed in your project (`npm install @stellar/stellar-sdk`)
- A basic understanding of Stellar transactions

## 3. Implementation Guide

Here is the exact implementation used in **StellrFlow** to allow users to execute on-chain workflow steps without holding XLM.

### Step 1: Initialize the Transaction

Normally, a user builds and signs a transaction:

```typescript
import { TransactionBuilder, Networks, BASE_FEE } from "@stellar/stellar-sdk";

// The user builds the inner transaction
let innerTx = new TransactionBuilder(userAccount, { 
    fee: BASE_FEE, 
    networkPassphrase: Networks.PUBLIC 
})
.addOperation(...) // Add contract invokes or transfers here
.setTimeout(30)
.build();

// The user signs it
innerTx.sign(userKeypair);
```

### Step 2: Create the Fee Bump Transaction

Now, the backend (acting as the sponsor) wraps the user's signed transaction into a Fee Bump transaction.

```typescript
// Define your sponsor keypair
const sponsorKeypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);

// Build the Fee Bump transaction
const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    sponsorKeypair,
    BASE_FEE, // You can increase this for priority
    innerTx,
    Networks.PUBLIC
);

// The sponsor signs the outer wrapper
feeBumpTx.sign(sponsorKeypair);
```

### Step 3: Submit to Horizon

Finally, submit the wrapped transaction to the network.

```typescript
const horizon = new server("https://horizon.stellar.org");

try {
    const result = await horizon.submitTransaction(feeBumpTx);
    console.log("Success! Transaction Hash:", result.hash);
} catch (error) {
    console.error("Fee bump failed:", error);
}
```

## 4. Conclusion

By implementing Fee Sponsorship, **StellrFlow** allows users to trigger complex automated workflows entirely gas-free, drastically lowering the barrier to entry for Web3.

For the full implementation, check out our `bots/telegram-stellar/src/routes/transaction.ts` file in the repository!

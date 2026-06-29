// API service for StellrFlow - Stellar Telegram bot integration

const STELLAR_BOT_URL =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_STELLAR_BOT_URL) ||
  "http://localhost:3003";

// ─── Response Types ─────────────────────────────────────────────────────────

interface ApiResponse {
  success: boolean;
  error?: string;
}

interface BalanceResponse extends ApiResponse {
  balance?: string;
  address?: string;
}

interface WalletResponse extends ApiResponse {
  publicKey?: string;
  message?: string;
  isNew?: boolean;
  xlmBalance?: string;
  otherBalances?: Array<{ asset: string; balance: string; issuer?: string }>;
  network?: string;
}

interface TxResponse extends ApiResponse {
  hash?: string;
  explorerUrl?: string;
}

interface NodeConfig {
  [key: string]: string | number | boolean | string[];
}

interface ExecutionInput {
  [key: string]: unknown;
}

/** Safely extract a string from a config field */
function cfgStr(config: NodeConfig, key: string): string {
  const val = config[key];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}

/** Safely extract a string from an execution input field */
function inputStr(input: ExecutionInput | undefined, key: string): string {
  if (!input) return "";
  const val = input[key];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}

let isBotActive = false;

// Telegram API - uses Stellar bot backend
export const telegramApi = {
  sendMessage: async (chatId: string, message: string, parseMode: string = "Markdown") => {
    const response = await fetch(`${STELLAR_BOT_URL}/api/telegram/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message, parseMode }),
    });
    return response.json();
  },

  // Send welcome message when only Telegram block is connected (no other blocks)
  sendWelcomeMessage: async (chatId: string) => {
    const message =
      `🎉 **Connected to StellrFlow!**\n\n` +
      `Your Telegram is now linked to StellrFlow.\n\n` +
      `⚠️ _No workflow blocks connected yet._\n\n` +
      `Add blocks in the workflow builder to enable features:\n` +
      `• **Stellar SDK (Chatbot)** - Ask questions about Stellar\n` +
      `• **Wallet Integration** - Connect Freighter wallet\n` +
      `• **Send Telegram** - Send notifications\n\n` +
      `_Powered by Stellar_`;
    return telegramApi.sendMessage(chatId, message);
  },

  // Send message when Stellar SDK chatbot is connected
  sendChatbotEnabledMessage: async (chatId: string) => {
    const message =
      `🤖 **Stellar AI Chatbot Activated!**\n\n` +
      `You can now ask me anything about Stellar:\n` +
      `• What is Stellar?\n` +
      `• How does Soroban work?\n` +
      `• What are Stellar anchors?\n` +
      `• /balance <address> - Check XLM balance\n\n` +
      `Just type your question and I'll help!\n\n` +
      `_Powered by Stellar_`;
    return telegramApi.sendMessage(chatId, message);
  },

  // Send message when Wallet Integration is connected (Freighter)
  sendWalletSetupMessage: async (chatId: string, walletUrl: string, network: string = "testnet") => {
    const message =
      `👛 **Wallet Integration Enabled!**\n\n` +
      `Connect your Freighter wallet to interact with Stellar:\n\n` +
      `👉 [Click here to connect Freighter](${walletUrl})\n\n` +
      `Once connected, you can:\n` +
      `• View your balances\n` +
      `• Sign transactions\n` +
      `• Interact with Stellar dApps\n\n` +
      `Network: ${network}\n\n` +
      `_Powered by Stellar_`;
    return telegramApi.sendMessage(chatId, message);
  },

  // Send message when Telegram Wallet is created
  sendTelegramWalletMessage: async (chatId: string, publicKey: string, isNew: boolean, network: string = "testnet") => {
    const message = isNew
      ? `🎉 **Your Stellar Wallet is Ready!**\n\n` +
      `**Address:**\n\`${publicKey}\`\n\n` +
      `📱 **Wallet Commands:**\n` +
      `/mybalance - Check your balance\n` +
      `/mywallet - Show your address\n` +
      `/send <address> <amount> - Send XLM\n` +
      `/fundwallet - Get free testnet XLM\n\n` +
      `Network: ${network}\n\n` +
      `_Your wallet is securely stored in the bot._`
      : `👛 **Wallet Already Created!**\n\n` +
      `**Address:**\n\`${publicKey}\`\n\n` +
      `Use /mybalance to check your balance.\n` +
      `Network: ${network}`;
    return telegramApi.sendMessage(chatId, message);
  },

  // Register session with enabled features
  registerSession: async (chatId: string, features: string[]) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/session/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, features }),
      });
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to register session" };
    }
  },

  sendAuthMessage: async (chatId: string, workflowName?: string) => {
    const message =
      `🔐 **StellrFlow Authentication**\n\n` +
      `You're connected! Your workflow${workflowName ? ` "${workflowName}"` : ""} has started.\n\n` +
      `Reply with:\n` +
      `• /balance <address> - Check Stellar balance\n` +
      `• Ask any Stellar question for help\n\n` +
      `_Powered by Stellar_`;
    return telegramApi.sendMessage(chatId, message);
  },

  getStatus: async () => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/telegram/health`);
      const data = await response.json();
      return { success: data.status === "ok", ...data };
    } catch {
      return { success: false, error: "Bot unreachable" };
    }
  },
};

// Stellar API
export const stellarApi = {
  getBalance: async (address: string) => {
    try {
      const response = await fetch(
        `${STELLAR_BOT_URL}/api/stellar/balance/${encodeURIComponent(address)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to fetch balance" };
      }
      return {
        success: true,
        balance: data.balance,
        address: data.address,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  sendTelegram: async (chatId: string, message: string, parseMode?: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/telegram/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message, parseMode }),
      });
      const data = await response.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  health: async () => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/telegram/health`);
      const data = await response.json();
      return { ok: data.status === "ok", network: data.network };
    } catch {
      return { ok: false };
    }
  },
};

// Telegram Wallet API - for in-bot wallets
export const telegramWalletApi = {
  // Create wallet for a chat
  createWallet: async (chatId: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/wallet/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to create wallet" };
    }
  },

  // Get wallet info
  getWallet: async (chatId: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/wallet/${encodeURIComponent(chatId)}`);
      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Wallet not found" };
      }
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to get wallet" };
    }
  },

  // Get wallet balance (uses the wallet's own address)
  getBalance: async (chatId: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/wallet/${encodeURIComponent(chatId)}/balance`);
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to get balance" };
    }
  },

  // Fund wallet (testnet only)
  fundWallet: async (chatId: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/wallet/${encodeURIComponent(chatId)}/fund`, {
        method: "POST",
      });
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to fund wallet" };
    }
  },

  // Send XLM from wallet
  sendXLM: async (chatId: string, destination: string, amount: string) => {
    try {
      const response = await fetch(`${STELLAR_BOT_URL}/api/wallet/${encodeURIComponent(chatId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, amount }),
      });
      return response.json();
    } catch (error) {
      return { success: false, error: "Failed to send XLM" };
    }
  },
};

// Node executors
export const nodeExecutors = {
  // Execute Telegram trigger - registers session and sends initial connection message
  // Connected blocks will send their own detailed messages
  executeTelegramConnect: async (config: NodeConfig, connectedNodeTypes: string[] = []) => {
    const chatId = cfgStr(config, "chatId").trim();
    if (!chatId) {
      throw new Error("Telegram Chat ID is required. Send /register to the bot to get yours.");
    }
    if (chatId.startsWith("@")) {
      throw new Error(
        "Use your numeric Chat ID, not username. Open the bot in Telegram and send /register to get your Chat ID."
      );
    }

    // Determine which features are enabled based on connected nodes
    const features: string[] = [];
    const hasChatbot = connectedNodeTypes.includes("stellar-sdk");
    const hasWallet = connectedNodeTypes.includes("wallet-integration");
    const hasTelegramSend = connectedNodeTypes.includes("telegram-send");

    if (hasChatbot) features.push("chatbot");
    if (hasWallet) features.push("wallet");
    if (hasTelegramSend) features.push("telegram-send");

    // Register session with backend to enable/disable features
    await telegramApi.registerSession(chatId, features);

    let result;

    if (connectedNodeTypes.length === 0) {
      // No blocks connected - just welcome message
      result = await telegramApi.sendWelcomeMessage(chatId);
    } else {
      // Blocks are connected - send brief connection confirmation
      // The connected blocks will send their own detailed messages
      const enabledFeatures = [];
      if (hasChatbot) enabledFeatures.push("Stellar AI Chatbot");
      if (hasWallet) enabledFeatures.push("Wallet Integration");
      if (hasTelegramSend) enabledFeatures.push("Notifications");

      const message =
        `🚀 **StellrFlow Connected!**\n\n` +
        `Your workflow is now active with:\n` +
        enabledFeatures.map(f => `✅ ${f}`).join('\n') +
        `\n\n_Setting up features..._`;

      result = await telegramApi.sendMessage(chatId, message);
    }

    if (!result.success) {
      throw new Error(result.error || "Failed to send message. Is the bot running?");
    }

    return { success: true, chatId, features, message: "Connected successfully" };
  },

  executeTelegramSend: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = String(config.chatId || "") || inputStr(inputData, "chatId");
    let message = String(config.message || "");

    if (!chatId) {
      throw new Error("Telegram Chat ID is required");
    }

    const balance = inputStr(inputData, "balance");
    if (balance) {
      message = message.replace(/\{balance\}/g, balance);
    }
    const address = inputStr(inputData, "address");
    if (address) {
      message = message.replace(/\{address\}/g, address);
    }

    const formattedMessage = `🔔 <b>StellrFlow Notification</b>\n\n${message || "Notification from StellrFlow"}`;

    const result = await stellarApi.sendTelegram(chatId, formattedMessage, "HTML");

    if (!result.success) {
      throw new Error(result.error || "Failed to send message");
    }

    return { success: true, sentTo: chatId, message, inputData };
  },

  executeStellarSDK: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const operation = String(config.operation || "chatbot");
    const chatId = inputStr(inputData, "chatId");

    if (!chatId) {
      throw new Error("Chat ID required. Connect this block to a Telegram trigger first.");
    }

    if (operation === "chatbot") {
      const message =
        `🤖 **Stellar AI Chatbot Activated!**\n\n` +
        `I can now answer your questions about Stellar!\n\n` +
        `**Try asking:**\n` +
        `• What is Stellar?\n` +
        `• How does Soroban work?\n` +
        `• What are Stellar anchors?\n` +
        `• Tell me about XLM\n\n` +
        `**Commands:**\n` +
        `/balance <address> - Check any address balance\n` +
        `/help - Show all commands\n\n` +
        `_Just type your question and I'll help!_`;

      await telegramApi.sendMessage(chatId, message);

      return {
        success: true,
        operation: "chatbot",
        chatId,
        message: "Stellar AI Chatbot is now active. User can ask questions in Telegram.",
      };
    }

    const destination =
      String(config.destination || "") || inputStr(inputData, "destination") || inputStr(inputData, "address");
    if (!destination) {
      throw new Error("Stellar address is required for balance check");
    }

    const result = await stellarApi.getBalance(destination);
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch balance");
    }

    // Send balance result to user
    const balanceMessage =
      `💰 **Balance Check**\n\n` +
      `**Address:** \`${destination.slice(0, 8)}...${destination.slice(-8)}\`\n` +
      `**Balance:** ${result.balance} XLM\n\n` +
      `Network: ${cfgStr(config, "network") || "testnet"}`;

    await telegramApi.sendMessage(chatId, balanceMessage);

    return {
      success: true,
      operation: "balance",
      address: result.address || destination,
      balance: result.balance,
      network: cfgStr(config, "network") || "testnet",
      chatId,
    };
  },

  executeWalletIntegration: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Connect this block to a Telegram trigger first.");
    }

    const walletProvider = cfgStr(config, "walletProvider") || "freighter";
    const network = cfgStr(config, "network") || "testnet";

    if (walletProvider === "telegram") {
      // Telegram Wallet - create an in-bot wallet
      const createResult = await telegramWalletApi.createWallet(chatId);

      if (!createResult.success) {
        throw new Error(createResult.error || "Failed to create Telegram wallet");
      }

      // Send message to user with wallet info
      const message = createResult.isNew
        ? `🎉 **Your Stellar Wallet is Ready!**\n\n` +
        `**Address:**\n\`${createResult.publicKey}\`\n\n` +
        `📱 **Wallet Commands:**\n` +
        `/mybalance - Check your balance\n` +
        `/mywallet - Show your address\n` +
        `/send <address> <amount> - Send XLM\n` +
        `/fundwallet - Get free testnet XLM\n` +
        `/disconnect - Disconnect wallet\n\n` +
        `Network: ${network}\n\n` +
        `_Your wallet is securely stored in the bot._`
        : `👛 **Wallet Already Created!**\n\n` +
        `**Address:**\n\`${createResult.publicKey}\`\n\n` +
        `Use /mybalance to check your balance.`;

      await telegramApi.sendMessage(chatId, message);

      return {
        success: true,
        mode: "telegram-wallet",
        walletProvider: "telegram",
        publicKey: createResult.publicKey,
        isNew: createResult.isNew,
        chatId,
        network,
        message: createResult.isNew ? "Telegram wallet created" : "Telegram wallet already exists",
      };
    } else {
      // Freighter Wallet - generate connection URL
      const walletUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/connect-wallet?chatId=${chatId}&network=${network}`;

      // Send message to user with Freighter connection link (HTML format for clickable links)
      const message =
        `🦊 <b>Freighter Wallet Integration</b>\n\n` +
        `Connect your Freighter browser extension wallet to Stellar:\n\n` +
        `👉 <a href="${walletUrl}">Click here to connect</a>\n\n` +
        `<b>After connecting you can:</b>\n` +
        `• View your wallet balances\n` +
        `• Sign and approve transactions\n` +
        `• Interact with Stellar dApps\n\n` +
        `<b>Requirements:</b>\n` +
        `• Freighter extension installed\n` +
        `• Open link in browser with Freighter\n\n` +
        `Network: ${network}\n\n` +
        `🔗 Get Freighter: <a href="https://freighter.app">freighter.app</a>`;

      await telegramApi.sendMessage(chatId, message, "HTML");

      return {
        success: true,
        mode: "freighter-wallet",
        walletProvider: "freighter",
        chatId,
        walletUrl,
        network,
        message: "Freighter connection link sent to user",
      };
    }
  },

  // NEW: Get wallet balance - for Telegram wallet (uses stored wallet address, NOT SDK balance)
  executeWalletBalance: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Chat ID is required. Connect to a Telegram trigger first.");
    }

    // Get balance of user's own Telegram wallet
    const result = await telegramWalletApi.getBalance(chatId);

    if (!result.success) {
      throw new Error(result.error || "Failed to get wallet balance");
    }

    // Send balance to user in Telegram
    const message =
      `💰 **Your Wallet Balance**\n\n` +
      `**XLM:** ${result.xlmBalance}\n` +
      (result.otherBalances?.length > 0
        ? `\n**Other Assets:**\n${result.otherBalances.map((b: { balance: string; asset: string }) => `• ${b.balance} ${b.asset}`).join('\n')}\n`
        : "") +
      `\nAddress: \`${result.publicKey?.slice(0, 8)}...${result.publicKey?.slice(-8)}\`\n` +
      `Network: ${result.network}`;

    await telegramApi.sendMessage(chatId, message);

    return {
      success: true,
      chatId,
      publicKey: result.publicKey,
      xlmBalance: result.xlmBalance,
      otherBalances: result.otherBalances,
      network: result.network,
    };
  },

  // Execute Anchor On-Ramp (Fiat → XLM)
  executeAnchorOnRamp: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Chat ID is required. Connect to a Telegram trigger first.");
    }

    const amount = parseFloat(cfgStr(config, "amount")) || 100;
    const currency = cfgStr(config, "fiatCurrency") || "USD";

    // Call backend anchor deposit endpoint
    const response = await fetch(`${STELLAR_BOT_URL}/api/anchor/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, amount, currency }),
    });

    const result = await response.json();

    if (!result.success) {
      // Notify user of failure
      await telegramApi.sendMessage(
        chatId,
        `❌ **Deposit Failed**\n\n${result.error || "Unable to process deposit."}`
      );
      throw new Error(result.error || "Anchor deposit failed");
    }

    // Notify user of success
    const message =
      `✅ **Deposit Successful!**\n\n` +
      `**Deposited:** ${amount} ${currency}\n` +
      `**Credited:** ${result.creditedXLM?.toFixed(4) || "—"} XLM\n` +
      `**Deposit ID:** \`${result.depositId}\`\n\n` +
      `Use /mybalance to check your updated balance.`;

    await telegramApi.sendMessage(chatId, message);

    return {
      success: true,
      chatId,
      depositId: result.depositId,
      fiatAmount: amount,
      currency,
      creditedXLM: result.creditedXLM,
    };
  },

  // Execute Anchor Off-Ramp (XLM → Fiat)
  executeAnchorOffRamp: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Chat ID is required. Connect to a Telegram trigger first.");
    }

    const xlmAmount = parseFloat(cfgStr(config, "amount")) || 10;
    const currency = cfgStr(config, "fiatCurrency") || "USD";

    // Call backend anchor withdrawal endpoint
    const response = await fetch(`${STELLAR_BOT_URL}/api/anchor/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, xlmAmount, currency }),
    });

    const result = await response.json();

    if (!result.success) {
      await telegramApi.sendMessage(
        chatId,
        `❌ **Withdrawal Failed**\n\n${result.error || "Unable to process withdrawal."}`
      );
      throw new Error(result.error || "Anchor withdrawal failed");
    }

    // Notify user of success
    const message =
      `✅ **Withdrawal Processed!**\n\n` +
      `**Withdrawn:** ${xlmAmount} XLM\n` +
      `**Payout:** ${result.fiatPayout?.toFixed(2) || "—"} ${currency}\n` +
      `**Withdrawal ID:** \`${result.withdrawalId}\`\n` +
      `**ETA:** ${result.eta || "5-10 min"}\n\n` +
      `_Demo: In production, funds would be sent to your bank._`;

    await telegramApi.sendMessage(chatId, message);

    return {
      success: true,
      chatId,
      withdrawalId: result.withdrawalId,
      xlmAmount,
      fiatPayout: result.fiatPayout,
      currency,
      eta: result.eta,
    };
  },

  // Execute AutoPay Setup (Recurring Payments)
  executeAutoPay: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Chat ID is required. Connect to a Telegram trigger first.");
    }

    const destination = cfgStr(config, "destination").trim();
    const amount = parseFloat(cfgStr(config, "amount")) || 10;
    const interval = cfgStr(config, "interval") || "daily";
    const duration = parseInt(cfgStr(config, "duration")) || 30;

    if (!destination) {
      throw new Error("Destination address is required for AutoPay");
    }

    // Call backend to set up scheduled payment
    const response = await fetch(`${STELLAR_BOT_URL}/api/autopay/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, destination, amount, interval, duration }),
    });

    const result = await response.json();

    if (!result.success) {
      await telegramApi.sendMessage(
        chatId,
        `❌ **AutoPay Setup Failed**\n\n${result.error || "Unable to create scheduled payment."}`
      );
      throw new Error(result.error || "AutoPay setup failed");
    }

    // Notify user
    const intervalText = interval === "daily" ? "every day" :
      interval === "weekly" ? "every week" :
        interval === "monthly" ? "every month" : interval;

    const message =
      `✅ **AutoPay Activated!**\n\n` +
      `**Amount:** ${amount} XLM\n` +
      `**To:** \`${destination.slice(0, 8)}...${destination.slice(-8)}\`\n` +
      `**Frequency:** ${intervalText}\n` +
      `**Duration:** ${duration} days\n` +
      `**Schedule ID:** \`${result.scheduleId}\`\n\n` +
      `Use /autopay to manage your schedules.`;

    await telegramApi.sendMessage(chatId, message);

    return {
      success: true,
      chatId,
      scheduleId: result.scheduleId,
      destination,
      amount,
      interval,
      duration,
      nextPayment: result.nextPayment,
    };
  },

  // Execute Multisig Setup (Multi-approval)
  executeMultisig: async (config: NodeConfig, inputData?: ExecutionInput) => {
    const chatId = inputStr(inputData, "chatId") || String(config.chatId || "");
    if (!chatId) {
      throw new Error("Chat ID is required. Connect to a Telegram trigger first.");
    }

    const threshold = parseInt(cfgStr(config, "threshold")) || 2;
    const signers = Array.isArray(config.signers) ? config.signers : [];
    const timeout = parseInt(cfgStr(config, "timeout")) || 24;

    if (signers.length < threshold) {
      throw new Error(`Need at least ${threshold} signers configured`);
    }

    // Call backend to set up multisig requirement
    const response = await fetch(`${STELLAR_BOT_URL}/api/multisig/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, threshold, signers, timeout }),
    });

    const result = await response.json();

    if (!result.success) {
      await telegramApi.sendMessage(
        chatId,
        `❌ **Multisig Setup Failed**\n\n${result.error || "Unable to configure multisig."}`
      );
      throw new Error(result.error || "Multisig setup failed");
    }

    // Notify user
    const message =
      `✅ **Multisig Configured!**\n\n` +
      `**Threshold:** ${threshold} of ${signers.length} signatures required\n` +
      `**Approval Timeout:** ${timeout} hours\n` +
      `**Multisig ID:** \`${result.multisigId}\`\n\n` +
      `Transactions will require ${threshold} approvals before execution.`;

    await telegramApi.sendMessage(chatId, message);

    return {
      success: true,
      chatId,
      multisigId: result.multisigId,
      threshold,
      signerCount: signers.length,
      timeout,
    };
  },
};

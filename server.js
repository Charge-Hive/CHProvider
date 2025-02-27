const express = require("express");
const {
  AccountId,
  PrivateKey,
  Client,
  Hbar,
  AccountCreateTransaction,
} = require("@hashgraph/sdk");

const app = express();

// Replace with your Hedera account ID and private key
const MY_ACCOUNT_ID = AccountId.fromString("0.0.5530044");
const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA(
  "731025b6bfb69ae6f9d2c673c81a4094bf97bde8ed993fe8ecd8b84b02010aaf"
);

// Function to generate a new Hedera account
const generateHederaAccount = async () => {
  try {
    const client = Client.forTestnet().setOperator(
      MY_ACCOUNT_ID,
      MY_PRIVATE_KEY
    );

    // Generate a new key pair for the account
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;

    // Create a new account with an initial balance of 10 Hbar
    const txCreateAccount = new AccountCreateTransaction()
      .setKey(accountPublicKey)
      .setInitialBalance(new Hbar(10));

    // Execute the transaction
    const txCreateAccountResponse = await txCreateAccount.execute(client);
    const receiptCreateAccountTx = await txCreateAccountResponse.getReceipt(
      client
    );
    const accountId = receiptCreateAccountTx.accountId;

    if (!accountId) {
      throw new Error("Account ID not found in receipt");
    }

    // Return the account details
    return {
      accountId: accountId.toString(),
      privateKey: accountPrivateKey.toString(),
      publicKey: accountPublicKey.toString(),
      evmAddr: accountPublicKey.toEvmAddress().toString(),
    };
  } catch (error) {
    console.error("Error generating Hedera account:", error);
    throw error;
  }
};

// REST API endpoint to create a new Hedera account
app.get("/create-account", async (req, res) => {
  try {
    const accountDetails = await generateHederaAccount();
    res.json(accountDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

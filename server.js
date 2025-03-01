const express = require("express");
const {
  AccountId,
  PrivateKey,
  Client,
  Hbar,
  AccountCreateTransaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} = require("@hashgraph/sdk");
const { createClient } = require("@supabase/supabase-js"); // Import Supabase client

const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies

// Replace with your Hedera account ID and private key
const MY_ACCOUNT_ID = AccountId.fromString("0.0.5530044");
const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA(
  "731025b6bfb69ae6f9d2c673c81a4094bf97bde8ed993fe8ecd8b84b02010aaf"
);
const PARKING_MINT_CONTRACT_ID = "";

// Supabase configuration
const SUPABASE_URL = "https://fnxanxbxyoevmxxphksj.supabase.co"; // Replace with your Supabase URL
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZueGFueGJ4eW9ldm14eHBoa3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMDg5NTksImV4cCI6MjA1NTY4NDk1OX0.kKa-r21KhljxxGT3ted87LgH5eBKw9WOLqZpRHZRlz4"; // Replace with your Supabase API key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// API to mint a Parking NFT
app.post("/MintParkingNFT", async (req, res) => {
  const { addr, image_url, lat, long } = req.body;
  try {
    const client = Client.forTestnet().setOperator(
      MY_ACCOUNT_ID,
      MY_PRIVATE_KEY
    );
    // Create a transaction to call the smart contract
    const tx = new ContractExecuteTransaction()
      .setContractId(CONTRACT_ID)
      .setGas(100000) // Adjust gas limit as needed
      .setFunction(
        "mintParkingNFT",
        new ContractFunctionParameters()
          .addAddress(addr) // Address to mint the NFT to
          .addString(image_url) // Image URL
          .addString(lat) // Latitude
          .addString(long) // Longitude
      )
      .setMaxTransactionFee(new Hbar(2)); // Adjust fee as needed

    // Sign and execute the transaction
    const txResponse = await tx.execute(client);

    // Get the receipt of the transaction
    const receipt = await txResponse.getReceipt(client);

    // Get the NFT ID from the contract function result
    const nftId = receipt.contractFunctionResult?.getUint256(0);

    if (!nftId) {
      throw new Error(
        "Failed to retrieve NFT ID from the transaction receipt."
      );
    }

    res.status(200).json({ success: true, nftId: nftId.toString() });
  } catch (error) {
    console.error("Error minting NFT:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// New endpoint to update nft_id in Supabase
app.post("/updateNFT", async (req, res) => {
  try {
    // Query rows where nft_id is null
    const { data, error } = await supabase
      .from("Parking_Transactions")
      .update({ nft_id: "abc" })
      .is("nft_id", null);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    res.status(200).json({ success: true, updatedRows: data });
  } catch (error) {
    console.error("Error updating nft_id:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

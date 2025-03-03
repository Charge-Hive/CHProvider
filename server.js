const express = require("express");
const fs = require("fs");
const {
  AccountId,
  PrivateKey,
  Client,
  Hbar,
  AccountInfoQuery,
  AccountBalanceQuery,
  AccountCreateTransaction,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenTransferTransaction,
  TokenId,
  TokenType,
  TransferTransaction,
  TokenMintTransaction,
  TokenAssociateTransaction,
  NftId,
} = require("@hashgraph/sdk");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Replace with your Hedera account ID and private key
const MY_ACCOUNT_ID = AccountId.fromString("0.0.5530044");
const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA(
  "731025b6bfb69ae6f9d2c673c81a4094bf97bde8ed993fe8ecd8b84b02010aaf"
);
const ADAPTER_ID = AccountId.fromString("0.0.5640910");
// 0.0.5640055
const ADAPTER_KEY = PrivateKey.fromStringECDSA(
  "3030020100300706052b8104000a042204201f68551e88e1831f4bf1816b25a8abda65d47aa579d744e7bd1d23812c45b883"
);
const CONTRACT_ID = "0.0.5640053";
const chAdapterContractId = "0.0.5640053";
// const CHARGEHIVE_TOKEN_ID = AccountId.fromString("0.0.5630530");

// Read token details from file (generated by createParkingNFT.js)
let tokenDetails;
try {
  tokenDetails = JSON.parse(fs.readFileSync("tokenDetails.json"));
  console.log(`Loaded NFT token ID: ${tokenDetails.tokenId}`);
} catch (error) {
  console.error(
    "Warning: tokenDetails.json not found. Run createParkingNFT.js first."
  );
  tokenDetails = { tokenId: null };
}

// Supabase configuration
const SUPABASE_URL = "https://fnxanxbxyoevmxxphksj.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZueGFueGJ4eW9ldm14eHBoa3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMDg5NTksImV4cCI6MjA1NTY4NDk1OX0.kKa-r21KhljxxGT3ted87LgH5eBKw9WOLqZpRHZRlz4";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Track which NFTs have been minted/transferred
let mintedNfts = new Set();
try {
  const mintedData = JSON.parse(fs.readFileSync("mintedNfts.json"));
  mintedNfts = new Set(mintedData.minted);
  console.log(`Loaded record of ${mintedNfts.size} previously minted NFTs`);
} catch (error) {
  console.log("No previous minting record found. Starting fresh.");
}

// Function to save the current set of minted NFTs
const saveMintedNfts = () => {
  fs.writeFileSync(
    "mintedNfts.json",
    JSON.stringify({
      minted: Array.from(mintedNfts),
      lastUpdate: new Date().toISOString(),
    })
  );
};

// Function to find the next available NFT serial number
const getNextAvailableNft = () => {
  for (let i = 1; i <= 1000; i++) {
    if (!mintedNfts.has(i)) {
      return i;
    }
  }
  return null; // All NFTs have been minted
};

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
      .setKeyWithoutAlias(accountPublicKey)
      // .setKey(accountPublicKey)
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

    try {
      //Associate account to ChargeHive token
      const clientAssociate = Client.forTestnet().setOperator(
        accountId,
        accountPrivateKey
      );
      //Associate a token to an account and freeze the unsigned transaction for signing
      const transaction = await new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds(["0.0.5630530"])
        .freezeWith(clientAssociate);

      //Sign with the private key of the account that is being associated to a token
      const signTx = await transaction.sign(accountPrivateKey);

      //Submit the transaction to a Hedera network
      const txResponse = await signTx.execute(clientAssociate);

      //Request the receipt of the transaction
      const receipt = await txResponse.getReceipt(clientAssociate);

      //Get the transaction consensus status
      const transactionStatus = receipt.status;

      console.log(
        "The transaction is Associated to ChargeHive " +
          transactionStatus.toString()
      );
    } catch (error) {
      console.error("Error associating token to account:", error);
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

// Update nft_id in Supabase
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

// Get the status of the NFT collection
app.get("/nftStatus", (req, res) => {
  res.json({
    tokenId: tokenDetails.tokenId,
    totalSupply: 1000,
    mintedCount: mintedNfts.size,
    availableCount: 1000 - mintedNfts.size,
  });
});

app.post("/mintParkingNFT", async (req, res) => {
  const { hederaAccountId, privateKey } = req.body;

  // Validate inputs
  if (!hederaAccountId || !privateKey) {
    return res.status(400).json({
      success: false,
      error: "Missing hederaAccountId or privateKey in request body",
    });
  }

  // Check if NFT collection is initialized
  if (!tokenDetails.tokenId) {
    return res.status(500).json({
      success: false,
      error: "NFT collection not initialized. Run createParkingNFT.js first.",
    });
  }

  let client;
  try {
    // Parse recipient account details
    const recipientAccountId = AccountId.fromString(hederaAccountId);
    const recipientPrivateKey = PrivateKey.fromStringECDSA(privateKey);

    // Create Hedera client for the recipient
    client = Client.forTestnet().setOperator(
      recipientAccountId,
      recipientPrivateKey
    );

    // Step 1: Associate the token with the recipient account
    const associateTx = await new TokenAssociateTransaction()
      .setAccountId(recipientAccountId)
      .setTokenIds([TokenId.fromString(tokenDetails.tokenId)])
      .freezeWith(client);

    const signedAssociateTx = await associateTx.sign(recipientPrivateKey);
    const associateSubmit = await signedAssociateTx.execute(client);
    const associateReceipt = await associateSubmit.getReceipt(client);

    // Check token association status
    if (associateReceipt.status.toString() !== "SUCCESS") {
      throw new Error(
        `Token association failed with status: ${associateReceipt.status}`
      );
    }

    // Create treasury client for minting
    const treasuryClient = Client.forTestnet().setOperator(
      MY_ACCOUNT_ID,
      MY_PRIVATE_KEY
    );

    // Find the next available NFT serial number to mint
    const nextAvailableSerial = getNextAvailableNft();

    if (nextAvailableSerial === null) {
      return res.status(400).json({
        success: false,
        error: "No NFTs available for minting. Collection is full.",
      });
    }

    // Prepare metadata for the NFT
    const nftMetadata = Buffer.from(
      JSON.stringify({
        recipientId: hederaAccountId,
        mintTimestamp: new Date().toISOString(),
        serialNumber: nextAvailableSerial,
      })
    );

    // Mint the new NFT
    const mintTx = await new TokenMintTransaction()
      .setTokenId(TokenId.fromString(tokenDetails.tokenId))
      .setMetadata([nftMetadata])
      .freezeWith(treasuryClient);

    const signedMintTx = await mintTx.sign(MY_PRIVATE_KEY);
    const mintSubmit = await signedMintTx.execute(treasuryClient);
    const mintReceipt = await mintSubmit.getReceipt(treasuryClient);

    // Verify successful minting
    if (mintReceipt.status.toString() !== "SUCCESS") {
      throw new Error(`Minting failed with status: ${mintReceipt.status}`);
    }

    // Get the serial number of the minted NFT
    const serialNumber = mintReceipt.serials[0];

    // Transfer the newly minted NFT to the recipient
    const nftId = new NftId(
      TokenId.fromString(tokenDetails.tokenId),
      serialNumber
    );

    const transferTx = await new TransferTransaction()
      .addNftTransfer(nftId, MY_ACCOUNT_ID, recipientAccountId)
      .freezeWith(treasuryClient);

    const signedTransferTx = await transferTx.sign(MY_PRIVATE_KEY);
    const transferSubmit = await signedTransferTx.execute(treasuryClient);
    const transferReceipt = await transferSubmit.getReceipt(treasuryClient);

    // Verify successful transfer
    if (transferReceipt.status.toString() !== "SUCCESS") {
      throw new Error(`Transfer failed with status: ${transferReceipt.status}`);
    }

    // Mark NFT as minted
    mintedNfts.add(nextAvailableSerial);
    saveMintedNfts();

    // Format the NFT ID for database storage
    const formattedNftId = `${tokenDetails.tokenId}@${serialNumber}`;

    // Log to Supabase Parking_Transactions table
    const { data: transactionData, error: transactionError } = await supabase
      .from("Parking_Transactions")
      .insert({
        hedera_account_id: hederaAccountId,
        nft_id: formattedNftId,
        mint_timestamp: new Date().toISOString(),
      });

    if (transactionError) {
      console.error("Error logging transaction:", transactionError);
    }

    // Update the Parking table where provider_account_addr matches hederaAccountId
    const { data: parkingData, error: parkingError } = await supabase
      .from("Parking")
      .update({ nft_id: formattedNftId })
      .eq("provider_account_addr", hederaAccountId)
      .select();

    if (parkingError) {
      console.error("Error updating Parking table:", parkingError);
      throw new Error(
        `Failed to update Parking record: ${parkingError.message}`
      );
    }

    // Respond with success details
    res.status(200).json({
      success: true,
      nftId: formattedNftId,
      serialNumber: nextAvailableSerial,
      tokenId: tokenDetails.tokenId,
      recipient: hederaAccountId,
      associationTransactionId: associateSubmit.transactionId.toString(),
      mintTransactionId: mintSubmit.transactionId.toString(),
      transferTransactionId: transferSubmit.transactionId.toString(),
      parkingUpdated: parkingData && parkingData.length > 0,
    });
  } catch (error) {
    console.error(
      "Error processing NFT association, mint, and transfer:",
      error
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    // Ensure client is closed
    if (client) {
      await client.close();
    }
  }
});

app.post("/rewardParking", async (req, res) => {
  const { userAccountId, nftId, startTime, endTime } = req.body;

  // Validate inputs
  if (!userAccountId || !nftId) {
    return res.status(400).json({
      success: false,
      error:
        "Missing userAccountId,nftId, startTime or endTime in request body",
    });
  }

  try {
    // Create Hedera client for the adapter
    const client = Client.forTestnet().setOperator(ADAPTER_ID, ADAPTER_KEY);

    // Convert user account ID to wallet address (Solidity address)
    const userWalletAddress =
      AccountId.fromString(userAccountId).toSolidityAddress();

    console.log(`🔌 Adapter operating from: ${ADAPTER_ID}`);

    console.log("🔑 Completing adapter registration...");
    console.log(`   User wallet: ${userWalletAddress}`);

    const completeRegTx = await new ContractExecuteTransaction()
      .setContractId(chAdapterContractId)
      .setGas(500000)
      .setFunction(
        "createAccount",
        new ContractFunctionParameters()
          .addAddress(userWalletAddress)
          .addString("1")
          .addString(userAccountId)
      )
      .execute(client);

    const completeRegReceipt = await completeRegTx.getReceipt(client);
    console.log(`Transaction status: ${completeRegReceipt.status.toString()}`);
    console.log("✅ Registration completed successfully!");
    const adapterInfoQuery = new ContractCallQuery()
      .setContractId(chAdapterContractId)
      .setGas(600000)
      .setFunction(
        "isUserRegistered",
        new ContractFunctionParameters().addAddress(userWalletAddress)
      );

    const adapterInfoResult = await adapterInfoQuery.execute(client);
    const DID = adapterInfoResult.getBool(1);
    console.log(`User Registration - ${DID}`);
    console.log("Creating Parking Session....");
    // const startTime = Math.floor(Date.now() / 1000) + 3600;
    // const endTime = startTime + 2 * 60 * 60;
    const spotBookerWallet = "0.0.5616371";
    const contractId = "0.0.5640053";
    const startSessionTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction(
        "createParkingSession",
        new ContractFunctionParameters()
          .addInt64(startTime)
          .addInt64(endTime)
          .addAddress(userWalletAddress)
          .addAddress(
            AccountId.fromString(spotBookerWallet).toSolidityAddress()
          )
      )
      .execute(client);

    const startSessionReceipt = await startSessionTx.getReceipt(client);
    console.log("Session Start Status:", startSessionReceipt.status.toString());

    //   // Retrieve the session ID
    const startSessionRecord = await startSessionTx.getRecord(client);
    const sessionId = startSessionRecord.contractFunctionResult
      .getUint256(0)
      .toString();
    console.log("Generated Session ID:", sessionId);

    console.log(`Parking session created with ID: ${sessionId}`);

    const endSessionTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction(
        "endParkingSession",
        new ContractFunctionParameters().addUint256(sessionId).addInt64(1)
      );

    const txResponseEnd = await endSessionTx.execute(client);
    const receiptEnd = await txResponseEnd.getReceipt(client);

    console.log(
      `Parking session ${sessionId} ended with status: ${receiptEnd.status}`
    );

    const transaction = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(900000)
      .setFunction(
        "distributeRewards",
        new ContractFunctionParameters().addUint256(sessionId)
      );

    const txResponsee = await transaction.execute(client);
    const record = await txResponsee.getRecord(client);

    console.log(`\n✅ Rewards distributed successfully!`);
    console.log(
      `- Hashscan URL: https://hashscan.io/testnet/tx/${txResponsee.transactionId.toString()}`
    );

    // Respond with success
    res.status(200).json({
      success: true,
      transactionId: txResponsee.transactionId.toString(),
      hashscanUrl: `https://hashscan.io/testnet/tx/${txResponsee.transactionId.toString()}`,
    });
  } catch (error) {
    console.error("Error processing parking rewards:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this endpoint to your existing Express app

// REST API endpoint to get account balance (HBAR and ChargeHive token)
app.post("/account-balance", async (req, res) => {
  const { accountId, privateKey, tokenId } = req.body;
  let client;

  // Validate inputs
  if (!accountId || !privateKey) {
    return res.status(400).json({
      success: false,
      error: "Missing accountId or privateKey in request body",
    });
  }

  try {
    // Parse account details
    const hederaAccountId = AccountId.fromString(accountId);
    const hederaPrivateKey = PrivateKey.fromStringECDSA(privateKey);
    const chargeHiveTokenId = "0.0.5630530";

    // Create Hedera client with the provided account
    client = Client.forTestnet().setOperator(hederaAccountId, hederaPrivateKey);

    // Query account balance (includes HBAR and all tokens)
    const accountBalanceQuery = new AccountBalanceQuery().setAccountId(
      hederaAccountId
    );

    const balanceResponse = await accountBalanceQuery.execute(client);

    // Get HBAR balance
    const hbarBalance = balanceResponse.hbars.toTinybars().toString();

    // Get ChargeHive token balance
    const chargeHiveBalance =
      balanceResponse.tokens.get(chargeHiveTokenId)?.toString() || "0";

    // Get full account info for additional details if needed
    const accountInfoQuery = new AccountInfoQuery().setAccountId(
      hederaAccountId
    );

    const accountInfo = await accountInfoQuery.execute(client);

    // Return the balance information
    res.status(200).json({
      success: true,
      accountId: accountId,
      balances: {
        hbar: {
          tinybars: hbarBalance,
          hbar: (parseInt(hbarBalance) / 100000000).toFixed(8), // Convert tinybars to hbar
        },
        chargeHive: {
          tokenId: chargeHiveTokenId,
          balance: chargeHiveBalance,
        },
      },
      accountDetails: {
        key: accountInfo.key.toString(),
        balance: accountInfo.balance.toString(),
        receiverSignatureRequired: accountInfo.receiverSignatureRequired,
        expirationTime: accountInfo.expirationTime?.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching account balance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    // Ensure client is closed
    if (client) {
      await client.close();
    }
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`NFT token ID: ${tokenDetails.tokenId || "Not initialized"}`);
  console.log(`NFTs minted so far: ${mintedNfts.size}`);
});

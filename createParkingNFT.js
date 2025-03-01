const {
  AccountId,
  PrivateKey,
  Client,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
} = require("@hashgraph/sdk");
const fs = require("fs").promises;
const path = require("path");

async function createParkingNFTCollection() {
  // Treasury Account (Creator) Credentials
  const TREASURY_ACCOUNT_ID = AccountId.fromString("0.0.5530044");
  const TREASURY_PRIVATE_KEY = PrivateKey.fromStringECDSA(
    "731025b6bfb69ae6f9d2c673c81a4094bf97bde8ed993fe8ecd8b84b02010aaf"
  );

  // Create a Hedera testnet client
  const client = Client.forTestnet();
  client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_PRIVATE_KEY);

  try {
    // Create NFT Collection
    const createNftTx = await new TokenCreateTransaction()
      .setTokenName("Charge Hive Parking NFT")
      .setTokenSymbol("CHPARK")
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(TREASURY_ACCOUNT_ID)
      .setAdminKey(TREASURY_PRIVATE_KEY.publicKey)
      .setSupplyKey(TREASURY_PRIVATE_KEY.publicKey)
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);

    // Sign the transaction
    const signedCreateTx = await createNftTx.sign(TREASURY_PRIVATE_KEY);

    // Submit to Hedera network
    const createResponse = await signedCreateTx.execute(client);

    // Get the token ID
    const createReceipt = await createResponse.getReceipt(client);
    const tokenId = createReceipt.tokenId;

    // Prepare token details to store
    const tokenDetails = {
      tokenId: tokenId.toString(),
      tokenName: "Charge Hive Parking NFT",
      tokenSymbol: "CHPARK",
      treasuryAccountId: TREASURY_ACCOUNT_ID.toString(),
      creationTimestamp: new Date().toISOString(),
      network: "testnet",
    };

    // Write token details to JSON file
    const filePath = path.join(__dirname, "tokenDetails.json");
    await fs.writeFile(filePath, JSON.stringify(tokenDetails, null, 2));

    console.log(`NFT Collection created successfully!`);
    console.log(`Token ID: ${tokenId}`);
    console.log(`Token details stored in ${filePath}`);

    // Close the client connection
    await client.close();
  } catch (error) {
    console.error("Error creating NFT collection:", error);
  }
}

// Run the function
createParkingNFTCollection();

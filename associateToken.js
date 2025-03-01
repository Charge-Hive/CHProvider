const {
  AccountId,
  PrivateKey,
  Client,
  TokenAssociateTransaction,
} = require("@hashgraph/sdk"); // v2.46.0

async function main() {
  let client;
  try {
    // Your account ID and private key from string value
    const MY_ACCOUNT_ID = AccountId.fromString("0.0.5640348");
    const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA(
      "3030020100300706052b8104000a04220420e560aaadb429fed6ebaa5f1af8429c209259f989b1fb2aa05f528fb33a6f591c"
    );
    const CHARGEHIVE_TOKEN_ID = AccountId.fromString("0.0.5630530");
    // Pre-configured client for test network (testnet)
    client = Client.forTestnet();

    //Set the operator with the account ID and private key
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    // Start your code here

    //Associate a token to an account and freeze the unsigned transaction for signing
    const txTokenAssociate = await new TokenAssociateTransaction()
      .setAccountId(MY_ACCOUNT_ID)
      .setTokenIds(["0.0.5630530"]) //Fill in the token ID
      .freezeWith(client);

    //Sign with the private key of the account that is being associated to a token
    const signTxTokenAssociate = await txTokenAssociate.sign(MY_PRIVATE_KEY);

    //Submit the transaction to a Hedera network
    const txTokenAssociateResponse = await signTxTokenAssociate.execute(client);

    //Request the receipt of the transaction
    const receiptTokenAssociateTx = await txTokenAssociateResponse.getReceipt(
      client
    );

    //Get the transaction consensus status
    const statusTokenAssociateTx = receiptTokenAssociateTx.status;

    //Get the Transaction ID
    const txTokenAssociateId =
      txTokenAssociateResponse.transactionId.toString();

    console.log(
      "--------------------------------- Token Associate ---------------------------------"
    );
    console.log(
      "Receipt status           :",
      statusTokenAssociateTx.toString()
    );
    console.log("Transaction ID           :", txTokenAssociateId);
    console.log(
      "Hashscan URL             :",
      "https://hashscan.io/testnet/tx/" + txTokenAssociateId
    );
  } catch (error) {
    console.error(error);
  } finally {
    if (client) client.close();
  }
}

main();
